import { LearningInput } from "@adlab/contracts";
import { type Actor, buildDigest, weekStart } from "@adlab/core";
import {
  approvals,
  assets,
  auditLog,
  generationRuns,
  learnings,
  metricSnapshots,
  newId,
  platformObjects,
  spendLedger,
  tests,
  variants,
} from "@adlab/db";
import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { alert, audit } from "./audit";
import type { Ctx } from "./context";
import { forbidden, invalid } from "./errors";
import { toAudit, toLearning } from "./mappers";
import { getKillSwitch, getSetting, setSetting } from "./settings";

/** One command, one button: pause everything adlab launched and block new launches. */
export async function engageKillSwitch(ctx: Ctx, actor: Actor, reason: string) {
  await setSetting(
    ctx,
    "kill_switch",
    { engaged: true, reason, by: actor.name, at: ctx.now().toISOString() },
    actor.name,
  );
  const live = await ctx.db.select().from(platformObjects).where(eq(platformObjects.status, "ACTIVE"));
  const order = { campaign: 0, adset: 1, ad: 2 } as Record<string, number>;
  const failures: string[] = [];
  let paused = 0;
  for (const o of live.sort((a, b) => (order[a.kind] ?? 9) - (order[b.kind] ?? 9))) {
    try {
      await ctx.platform.setStatus(o.externalId, "PAUSED");
      await ctx.db.update(platformObjects).set({ status: "PAUSED" }).where(eq(platformObjects.id, o.id));
      paused++;
    } catch (err) {
      failures.push(`${o.kind} ${o.externalId}: ${(err as Error).message}`);
    }
  }
  await ctx.db.update(tests).set({ status: "paused" }).where(eq(tests.status, "running"));
  await audit(ctx, actor, "killswitch.engaged", "system", null, { reason, paused, failures });
  await alert(
    ctx,
    "killswitch",
    `Kill switch engaged by ${actor.name}: ${reason}. Paused ${paused} object(s).${failures.length ? ` ${failures.length} FAILED — check Ads Manager.` : ""}`,
  );
  return { engaged: true, paused, failures };
}

export async function releaseKillSwitch(ctx: Ctx, actor: Actor) {
  if (actor.kind !== "human") throw forbidden("Only a dashboard session can release the kill switch");
  await setSetting(
    ctx,
    "kill_switch",
    { engaged: false, by: actor.name, at: ctx.now().toISOString() },
    actor.name,
  );
  await audit(ctx, actor, "killswitch.released", "system", null, {});
  return { engaged: false, note: "Launches allowed again. Paused tests stay paused." };
}

/** The platform is the source of truth for live state: detect drift and flag it, never overwrite. */
export async function reconcile(ctx: Ctx, actor: Actor) {
  const rows = await ctx.db.select().from(platformObjects).where(sql`${platformObjects.status} <> 'DELETED'`);
  const live = await ctx.platform.getObjects(rows.map((r) => r.externalId));
  const drift: Array<{
    id: string;
    externalId: string;
    field: string;
    registry: unknown;
    platform: unknown;
  }> = [];
  for (const r of rows) {
    const p = live.find((l) => l.externalId === r.externalId);
    if (!p) {
      drift.push({ id: r.id, externalId: r.externalId, field: "exists", registry: true, platform: false });
      continue;
    }
    if (p.status !== r.status)
      drift.push({
        id: r.id,
        externalId: r.externalId,
        field: "status",
        registry: r.status,
        platform: p.status,
      });
    if (
      r.budgetCents !== null &&
      p.lifetimeBudgetCents !== undefined &&
      p.lifetimeBudgetCents !== r.budgetCents
    ) {
      drift.push({
        id: r.id,
        externalId: r.externalId,
        field: "lifetimeBudget",
        registry: r.budgetCents,
        platform: p.lifetimeBudgetCents,
      });
    }
    await ctx.db.update(platformObjects).set({ lastSeenState: p }).where(eq(platformObjects.id, r.id));
  }
  for (const d of drift) {
    await alert(
      ctx,
      "drift",
      `Drift on ${d.externalId}: ${d.field} is ${String(d.platform)} on the platform, ${String(d.registry)} in the registry. Not overwritten — review in Ads Manager.`,
      d,
    );
  }
  await audit(ctx, actor, "reconcile.ran", "system", null, { checked: rows.length, drift: drift.length });
  return { checked: rows.length, drift };
}

export async function trackingCheck(ctx: Ctx, actor: Actor, url: string) {
  const page = await ctx.checkUrl(url);
  const event = await ctx.platform.sendTestEvent("purchase", url);
  const health = await ctx.platform.health();
  await audit(ctx, actor, "tracking.checked", "system", null, {
    url,
    ok: page.loads && page.hasPixel && event.received,
  });
  return { ok: page.loads && page.hasPixel && event.received, page, event, account: health };
}

export async function overview(ctx: Ctx) {
  const week = weekStart(ctx.now());
  const ledger = await ctx.db.select().from(spendLedger).where(eq(spendLedger.weekStart, week));
  const [counts] = await ctx.db
    .execute(sql`select
      (select count(*) from briefs)::int as briefs,
      (select count(*) from variants)::int as variants,
      (select count(*) from tests where status = 'running')::int as running,
      (select count(*) from approvals where status = 'pending')::int as pending,
      (select count(*) from variants where status = 'won')::int as winners,
      (select count(distinct v) from tests, jsonb_array_elements_text(variant_ids) as v where started_at is not null)::int as tested,
      (select coalesce(sum(actual_cents),0) from spend_ledger)::int as media,
      (select coalesce(sum(cost_cents),0) from generation_runs)::int as gen,
      (select coalesce(sum(cost_cents),0) from assets)::int as render`)
    .then((r) => (Array.isArray(r) ? r : (r as { rows: unknown[] }).rows) as Array<Record<string, number>>);
  const c = counts ?? {};
  // Full cost per winner: media + generation + render, not just media spend.
  const fullCost = (c.media ?? 0) + (c.gen ?? 0) + (c.render ?? 0);
  const ks = await getKillSwitch(ctx);
  return {
    week: {
      start: week,
      capCents: ctx.config.weeklyCapCents,
      committedCents: ledger.reduce((s, l) => s + Math.max(l.committedCents, l.actualCents), 0),
      actualCents: ledger.reduce((s, l) => s + l.actualCents, 0),
    },
    counts: {
      briefs: c.briefs ?? 0,
      variants: c.variants ?? 0,
      testsRunning: c.running ?? 0,
      pendingApprovals: c.pending ?? 0,
      winners: c.winners ?? 0,
    },
    costPerVariantTestedCents: c.tested ? Math.round(fullCost / c.tested) : null,
    costPerWinnerCents: c.winners ? Math.round(fullCost / c.winners) : null,
    killSwitchEngaged: ks.engaged,
  };
}

export async function listActivity(ctx: Ctx, limit = 100) {
  return (await ctx.db.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(limit)).map(toAudit);
}

export async function digest(ctx: Ctx, hours = 24) {
  const until = ctx.now();
  const since = new Date(until.getTime() - hours * 3_600_000);
  const activity = (
    await ctx.db
      .select()
      .from(auditLog)
      .where(and(gte(auditLog.createdAt, since), lte(auditLog.createdAt, until)))
      .orderBy(desc(auditLog.createdAt))
  ).map(toAudit);
  // Spend in window = latest cumulative spend per ad minus its cumulative spend at window start.
  const snaps = await ctx.db
    .select({
      po: metricSnapshots.platformObjectId,
      spend: metricSnapshots.spendCents,
      at: metricSnapshots.capturedAt,
    })
    .from(metricSnapshots)
    .where(lte(metricSnapshots.capturedAt, until))
    .orderBy(metricSnapshots.capturedAt);
  const perAd = new Map<string, { before: number; latest: number }>();
  for (const s of snaps) {
    const e = perAd.get(s.po) ?? { before: 0, latest: 0 };
    if (s.at < since) e.before = s.spend;
    e.latest = s.spend;
    perAd.set(s.po, e);
  }
  const spendCents = [...perAd.values()].reduce((sum, e) => sum + Math.max(0, e.latest - e.before), 0);
  const pending = await ctx.db
    .select({ id: approvals.id, title: approvals.title, amountCents: approvals.amountCents })
    .from(approvals)
    .where(eq(approvals.status, "pending"));
  return buildDigest({ since, until, spendCents, activity, pendingApprovals: pending });
}

export async function sendDigest(ctx: Ctx, actor: Actor) {
  const d = await digest(ctx);
  const res = await ctx.notifier.send({ type: "digest", title: "adlab daily digest", text: d.text, data: d });
  await setSetting(ctx, "last_digest_at", ctx.now().toISOString(), actor.name);
  await audit(ctx, actor, "digest.sent", "system", null, { delivered: res.delivered, detail: res.detail });
  return { ...res, digest: d };
}

export const lastDigestAt = (ctx: Ctx) => getSetting<string | null>(ctx, "last_digest_at", null);

export async function addLearning(ctx: Ctx, actor: Actor, raw: unknown) {
  const input = LearningInput.parse(raw);
  // Evidence must exist: every learning links to the tests or decisions behind it.
  const testIds = input.evidenceIds.filter((id) => id.startsWith("tst_"));
  const known = testIds.length
    ? await ctx.db.select({ id: tests.id }).from(tests).where(inArray(tests.id, testIds))
    : [];
  const unknown = testIds.filter((id) => !known.some((k) => k.id === id));
  if (unknown.length) throw invalid(`Unknown evidence: ${unknown.join(", ")}`);
  const [row] = await ctx.db
    .insert(learnings)
    .values({
      id: newId("lrn"),
      briefId: input.briefId ?? null,
      statement: input.statement,
      evidenceIds: input.evidenceIds,
      confidence: input.confidence,
      tags: (input.tags ?? null) as never,
      status: "active",
      createdBy: actor.name,
      createdAt: ctx.now(),
    })
    .returning();
  await audit(ctx, actor, "learning.added", "learning", row!.id, { confidence: input.confidence });
  return toLearning(row!);
}

export async function listLearnings(ctx: Ctx) {
  const rows = await ctx.db.select().from(learnings).orderBy(desc(learnings.createdAt));
  // Learnings with no review in 60 days are surfaced as stale rather than silently trusted.
  const staleBefore = ctx.now().getTime() - 60 * 86_400_000;
  return rows
    .map(toLearning)
    .map((l) => ({ ...l, stale: new Date(l.reviewedAt ?? l.createdAt).getTime() < staleBefore }))
    .sort((a, b) => Number(b.status === "flagged") - Number(a.status === "flagged"));
}

export async function simAdvance(ctx: Ctx, actor: Actor, hours: number) {
  if (!ctx.fake) throw forbidden("sim.advance only works with ADLAB_PLATFORM=fake");
  ctx.fake.advance(hours);
  await audit(ctx, actor, "sim.advanced", "system", null, { hours, clockHours: ctx.fake.clockHours });
  return {
    clockHours: ctx.fake.clockHours,
    now: ctx.now().toISOString(),
    totalSpendCents: ctx.fake.totalSpend(),
  };
}

export async function costSummary(ctx: Ctx) {
  const [gen] = await ctx.db
    .select({ c: sql<number>`coalesce(sum(${generationRuns.costCents}),0)::int` })
    .from(generationRuns);
  const [ren] = await ctx.db
    .select({ c: sql<number>`coalesce(sum(${assets.costCents}),0)::int` })
    .from(assets);
  const [vc] = await ctx.db.select({ c: sql<number>`count(*)::int` }).from(variants);
  return { generationCents: gen?.c ?? 0, renderCents: ren?.c ?? 0, variants: vc?.c ?? 0 };
}
