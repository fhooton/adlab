import type { TestResults, VariantResult } from "@adlab/contracts";
import {
  type Actor,
  type ArmInput,
  deriveRates,
  emptyMetrics,
  evaluate,
  idempotencyKey,
  partitionProposals,
  ruleSetFor,
} from "@adlab/core";
import {
  approvals,
  decisions,
  metricSnapshots,
  newId,
  platformObjects,
  spendLedger,
  tests,
  variants,
} from "@adlab/db";
import { and, desc, eq, inArray } from "drizzle-orm";
import { audit } from "./audit";
import { requireBrief } from "./briefs";
import type { Ctx } from "./context";
import { conflict } from "./errors";
import { toDecision, toTest } from "./mappers";
import { requireTest } from "./tests";

/** Stage 8: pull cumulative insights for every ad in a test and store a snapshot per ad. */
export async function syncTest(ctx: Ctx, actor: Actor, testId: string) {
  const test = await requireTest(ctx, testId);
  if (!["running", "paused", "ended"].includes(test.status))
    throw conflict(`Test is ${test.status}; nothing to sync`);
  const brief = await requireBrief(ctx, test.briefId);
  const ads = await ctx.db
    .select()
    .from(platformObjects)
    .where(and(eq(platformObjects.testId, testId), eq(platformObjects.kind, "ad")));
  const rows = await ctx.platform.getInsights(
    ads.map((a) => a.externalId),
    brief.conversionEvent,
  );
  const now = ctx.now();
  let spend = 0;
  for (const r of rows) {
    const ad = ads.find((a) => a.externalId === r.externalId)!;
    spend += r.metrics.spendCents;
    await ctx.db.insert(metricSnapshots).values({
      id: newId("met"),
      platformObjectId: ad.id,
      variantId: ad.variantId,
      testId,
      ...r.metrics,
      frequency: r.metrics.frequency ?? null,
      definitionsVersion: r.definitionsVersion,
      raw: r.raw,
      capturedAt: now,
    });
  }
  await ctx.db
    .update(spendLedger)
    .set({ actualCents: spend, updatedAt: now })
    .where(eq(spendLedger.testId, testId));
  const complete = rows.length === ads.length;
  await audit(ctx, actor, "test.synced", "test", testId, { ads: rows.length, spendCents: spend, complete });
  return {
    testId,
    ads: ads.length,
    synced: rows.length,
    complete,
    spendCents: spend,
    syncedAt: now.toISOString(),
  };
}

async function latestPerAd(ctx: Ctx, testId: string) {
  const snaps = await ctx.db
    .select()
    .from(metricSnapshots)
    .where(eq(metricSnapshots.testId, testId))
    .orderBy(desc(metricSnapshots.capturedAt));
  const latest = new Map<string, (typeof snaps)[number]>();
  for (const s of snaps) if (!latest.has(s.platformObjectId)) latest.set(s.platformObjectId, s);
  return latest;
}

async function buildArms(ctx: Ctx, test: typeof tests.$inferSelect) {
  const ads = await ctx.db
    .select()
    .from(platformObjects)
    .where(and(eq(platformObjects.testId, test.id), eq(platformObjects.kind, "ad")));
  const vrows = await ctx.db.select().from(variants).where(inArray(variants.id, test.variantIds));
  const latest = await latestPerAd(ctx, test.id);
  const arms: ArmInput[] = test.variantIds.map((vid) => {
    const ad = ads.find((a) => a.variantId === vid);
    const snap = ad ? latest.get(ad.id) : undefined;
    const metrics = snap
      ? {
          impressions: snap.impressions,
          spendCents: snap.spendCents,
          views3s: snap.views3s,
          views15s: snap.views15s,
          clicks: snap.clicks,
          conversions: snap.conversions,
        }
      : emptyMetrics();
    return {
      variantId: vid,
      isControl: vrows.find((v) => v.id === vid)?.isControl ?? false,
      active: ad?.status === "ACTIVE",
      metrics,
    };
  });
  const lastSync = [...latest.values()].reduce<Date | null>(
    (max, s) => (!max || s.capturedAt > max ? s.capturedAt : max),
    null,
  );
  return { arms, ads, vrows, lastSync };
}

function hoursElapsed(ctx: Ctx, test: typeof tests.$inferSelect) {
  return test.startedAt ? (ctx.now().getTime() - test.startedAt.getTime()) / 3_600_000 : 0;
}

/** Pause one ad (reduces spend) and record it. */
async function pauseAd(ctx: Ctx, ad: typeof platformObjects.$inferSelect) {
  if (ad.status !== "ACTIVE") return;
  await ctx.platform.setStatus(ad.externalId, "PAUSED");
  await ctx.db.update(platformObjects).set({ status: "PAUSED" }).where(eq(platformObjects.id, ad.id));
}

/** Apply a decision's effect. Kill pauses; promote/scale record the winner (no automatic budget increases). */
export async function applyDecision(ctx: Ctx, actor: Actor, decision: typeof decisions.$inferSelect) {
  if (decision.status === "applied") return;
  if (decision.action === "kill") {
    const [ad] = await ctx.db
      .select()
      .from(platformObjects)
      .where(
        and(
          eq(platformObjects.testId, decision.testId),
          eq(platformObjects.variantId, decision.variantId),
          eq(platformObjects.kind, "ad"),
        ),
      );
    if (ad) await pauseAd(ctx, ad);
    await ctx.db.update(variants).set({ status: "killed" }).where(eq(variants.id, decision.variantId));
  } else if (decision.action === "promote") {
    await ctx.db.update(variants).set({ status: "ready" }).where(eq(variants.id, decision.variantId));
  } else if (decision.action === "scale") {
    await ctx.db.update(variants).set({ status: "won" }).where(eq(variants.id, decision.variantId));
  }
  await ctx.db
    .update(decisions)
    .set({ status: "applied", approvedBy: actor.name, appliedAt: ctx.now(), version: decision.version + 1 })
    .where(and(eq(decisions.id, decision.id), eq(decisions.version, decision.version)));
  const [v] = await ctx.db
    .select({ label: variants.label })
    .from(variants)
    .where(eq(variants.id, decision.variantId));
  await audit(ctx, actor, `decision.applied.${decision.action}`, "variant", decision.variantId, {
    summary: `${v?.label ?? decision.variantId}: ${decision.reason}`,
    decisionId: decision.id,
    testId: decision.testId,
  });
}

/** Stage 9: run the rules engine, auto-apply what policy allows, route the rest to approval. */
export async function decideTest(ctx: Ctx, actor: Actor, testId: string) {
  const test = await requireTest(ctx, testId);
  if (test.status !== "running")
    throw conflict(`Test is ${test.status}; decisions only run on running tests`);
  const rs = ruleSetFor(test.stage as 1 | 2, test.ruleVersion);
  const { arms, ads } = await buildArms(ctx, test);
  const ev = evaluate(rs, arms, {
    budgetCents: test.budgetCents,
    hoursElapsed: hoursElapsed(ctx, test),
    durationHours: test.durationHours,
  });
  const { autoApply, needsApproval, noop } = partitionProposals(ev.proposals, ctx.config.autoApply);
  const now = ctx.now();
  const rules: Actor = { kind: "system", name: `rules:${rs.version}` };

  const record = async (p: (typeof ev.proposals)[number], status: string) => {
    const key = idempotencyKey(testId, p.variantId, p.action, rs.version);
    const [existing] = await ctx.db.select().from(decisions).where(eq(decisions.idempotencyKey, key));
    if (existing) return { row: existing, isNew: false };
    const [row] = await ctx.db
      .insert(decisions)
      .values({
        id: newId("dec"),
        testId,
        variantId: p.variantId,
        action: p.action,
        reason: p.reason,
        ruleVersion: rs.version,
        inputsSnapshot: { ...ev.inputsSnapshot, arm: ev.arms.find((a) => a.variantId === p.variantId) },
        status,
        proposedBy: rules.name,
        idempotencyKey: key,
        createdAt: now,
      })
      .returning();
    return { row: row!, isNew: true };
  };

  const applied = [];
  for (const p of autoApply) {
    const { row } = await record(p, "proposed");
    if (row.status !== "applied") {
      await applyDecision(ctx, { kind: "system", name: "policy:auto-apply" }, row);
      applied.push(row.id);
    }
  }
  const pending = [];
  for (const p of needsApproval) {
    const { row, isNew } = await record(p, "pending_approval");
    if (isNew) pending.push(row);
  }
  let approval = null;
  if (pending.length) {
    const id = newId("apr");
    const labels = await ctx.db
      .select({ id: variants.id, label: variants.label })
      .from(variants)
      .where(
        inArray(
          variants.id,
          pending.map((d) => d.variantId),
        ),
      );
    [approval] = await ctx.db
      .insert(approvals)
      .values({
        id,
        kind: "apply_decisions",
        title: `${pending.length} decision(s) on stage ${test.stage} test`,
        summary: pending
          .map(
            (d) =>
              `• ${d.action.toUpperCase()} ${labels.find((l) => l.id === d.variantId)?.label ?? d.variantId}: ${d.reason}`,
          )
          .join("\n"),
        amountCents: null,
        actionPayload: { testId, decisionIds: pending.map((d) => d.id) },
        requestedBy: rules.name,
        idempotencyKey: `decide:${pending
          .map((d) => d.id)
          .sort()
          .join(",")}`,
        createdAt: now,
      })
      .returning();
  }

  // A complete test stops delivering; its lifetime budget is spent or its time is up.
  if (ev.complete) {
    for (const ad of ads) await pauseAd(ctx, ad);
    const [campaign] = await ctx.db
      .select()
      .from(platformObjects)
      .where(and(eq(platformObjects.testId, testId), eq(platformObjects.kind, "campaign")));
    if (campaign?.status === "ACTIVE") {
      await ctx.platform.setStatus(campaign.externalId, "PAUSED");
      await ctx.db
        .update(platformObjects)
        .set({ status: "PAUSED" })
        .where(eq(platformObjects.id, campaign.id));
    }
    await ctx.db.update(tests).set({ status: "ended", endedAt: now }).where(eq(tests.id, testId));
  }
  await audit(ctx, actor, "test.decided", "test", testId, {
    ruleVersion: rs.version,
    applied: applied.length,
    pendingApproval: pending.length,
    holds: noop.length,
    complete: ev.complete,
  });
  return {
    testId,
    ruleVersion: rs.version,
    complete: ev.complete,
    autoApplied: applied,
    pendingApproval: pending.map(toDecision),
    holds: noop,
    approvalId: approval?.id ?? null,
  };
}

export async function getTestResults(ctx: Ctx, testId: string): Promise<TestResults> {
  const test = await requireTest(ctx, testId);
  const rs = ruleSetFor(test.stage as 1 | 2, test.ruleVersion);
  const { arms, vrows, lastSync } = await buildArms(ctx, test);
  // Evaluate over every arm (active or not) for display, so killed arms still show intervals.
  const ev = evaluate(
    rs,
    arms.map((a) => ({ ...a, active: true })),
    {
      budgetCents: test.budgetCents,
      hoursElapsed: hoursElapsed(ctx, test),
      durationHours: test.durationHours,
    },
  );
  const decisionRows = await ctx.db
    .select()
    .from(decisions)
    .where(eq(decisions.testId, testId))
    .orderBy(desc(decisions.createdAt));
  const results: VariantResult[] = arms.map((a) => {
    const e = ev.arms.find((x) => x.variantId === a.variantId)!;
    const latest = decisionRows.find((d) => d.variantId === a.variantId);
    return {
      variantId: a.variantId,
      label: vrows.find((v) => v.id === a.variantId)?.label ?? a.variantId,
      isControl: a.isControl,
      metrics: a.metrics,
      rates: deriveRates(a.metrics),
      primaryMetric: rs.metric,
      interval: e.interval,
      probBest: e.probBest,
      enoughEvidence: e.enoughEvidence,
      latestDecision: latest ? toDecision(latest) : null,
    };
  });
  return {
    test: toTest(test),
    variants: results,
    lastSyncedAt: lastSync?.toISOString() ?? null,
    totalSpendCents: arms.reduce((s, a) => s + a.metrics.spendCents, 0),
  };
}
