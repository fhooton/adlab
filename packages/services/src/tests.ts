import type { CreativeInput, PlatformKind } from "@adlab/adapters";
import { CreateTestInput, type PreflightReport } from "@adlab/contracts";
import {
  type Actor,
  addHours,
  checkBudget,
  checkDuplicates,
  checkNaming,
  checkPolicy,
  checkSpecs,
  encodeName,
  idempotencyKey,
  type PreflightVariant,
  preflightOk,
  RULE_VERSION_BY_STAGE,
  splitBudget,
  trackedUrl,
  weekStart,
} from "@adlab/core";
import {
  approvals,
  assets,
  type briefs,
  newId,
  platformObjects,
  spendLedger,
  tests,
  variants,
} from "@adlab/db";
import { getTemplate } from "@adlab/render";
import { and, desc, eq, inArray, type SQL, sql } from "drizzle-orm";
import { audit } from "./audit";
import { requireBrief } from "./briefs";
import type { Ctx } from "./context";
import { blocked, conflict, invalid, notFound } from "./errors";
import { toApproval, toTest } from "./mappers";
import { getKillSwitch } from "./settings";

const STRUCTURE = "ABO: 1 campaign, 1 ad set per variant (lifetime budget split evenly), 1 ad per ad set";

export async function requireTest(ctx: Ctx, id: string) {
  const [row] = await ctx.db.select().from(tests).where(eq(tests.id, id));
  if (!row) throw notFound("Test", id);
  return row;
}

export async function createTest(ctx: Ctx, actor: Actor, raw: unknown) {
  const input = CreateTestInput.parse(raw);
  const brief = await requireBrief(ctx, input.briefId);
  if (!brief.platforms.includes(input.platform)) throw invalid(`Brief does not target ${input.platform}`);
  if (input.platform !== ctx.platform.platform)
    throw invalid(`This deployment runs ${ctx.platform.platform}; ${input.platform} is not connected`);
  const rows = await ctx.db.select().from(variants).where(inArray(variants.id, input.variantIds));
  const problems: string[] = [];
  for (const id of input.variantIds) {
    const v = rows.find((r) => r.id === id);
    if (!v) problems.push(`${id}: not found`);
    else if (v.briefId !== brief.id) problems.push(`${id}: belongs to another brief`);
    else if (!["rendered", "ready", "live"].includes(v.status))
      problems.push(`${id}: status ${v.status}; render it first`);
  }
  if (new Set(input.variantIds).size !== input.variantIds.length) problems.push("Duplicate variant ids");
  if (input.budgetCents < input.variantIds.length * 100)
    problems.push("Budget must be at least 100 cents per variant");
  if (problems.length) throw invalid("Cannot create test", problems);
  const id = newId("tst");
  const [row] = await ctx.db
    .insert(tests)
    .values({
      id,
      briefId: brief.id,
      stage: input.stage,
      platform: input.platform,
      structure: STRUCTURE,
      status: "draft",
      budgetCents: input.budgetCents,
      durationHours: input.durationHours,
      variantIds: input.variantIds,
      ruleVersion: RULE_VERSION_BY_STAGE[input.stage],
      createdBy: actor.name,
      createdAt: ctx.now(),
    })
    .returning();
  await audit(ctx, actor, "test.created", "test", id, {
    stage: input.stage,
    variants: input.variantIds.length,
    budgetCents: input.budgetCents,
  });
  return toTest(row!);
}

export async function listTests(ctx: Ctx, filter: { briefId?: string; status?: string }) {
  const where: SQL[] = [];
  if (filter.briefId) where.push(eq(tests.briefId, filter.briefId));
  if (filter.status) where.push(eq(tests.status, filter.status));
  return (
    await ctx.db
      .select()
      .from(tests)
      .where(where.length ? and(...where) : undefined)
      .orderBy(desc(tests.createdAt))
  ).map(toTest);
}

async function ledgerFor(ctx: Ctx, briefId: string) {
  const week = weekStart(ctx.now());
  const account = ctx.platform.platform;
  const accountWeek = await ctx.db
    .select()
    .from(spendLedger)
    .where(and(eq(spendLedger.account, account), eq(spendLedger.weekStart, week)));
  return { week, account, accountWeek, briefWeek: accountWeek.filter((l) => l.briefId === briefId) };
}

export async function budgetCheckFor(
  ctx: Ctx,
  test: typeof tests.$inferSelect,
  brief: typeof briefs.$inferSelect,
) {
  const ledger = await ledgerFor(ctx, brief.id);
  const ks = await getKillSwitch(ctx);
  return {
    ...ledger,
    check: checkBudget({
      accountCapCents: ctx.config.weeklyCapCents,
      briefCapCents: brief.weeklyCapCents,
      accountWeek: ledger.accountWeek,
      briefWeek: ledger.briefWeek,
      requestedCents: test.budgetCents,
      killSwitchEngaged: ks.engaged,
    }),
  };
}

/** Stage 6: policy, spec, duplicate, naming, budget and tracking checks. */
export async function runPreflight(ctx: Ctx, actor: Actor, testId: string): Promise<PreflightReport> {
  const test = await requireTest(ctx, testId);
  if (!["draft", "ready", "preflight_failed"].includes(test.status))
    throw conflict(`Test is ${test.status}; pre-flight only runs before launch`);
  const brief = await requireBrief(ctx, test.briefId);
  const vrows = await ctx.db.select().from(variants).where(inArray(variants.id, test.variantIds));
  const arows = await ctx.db.select().from(assets).where(inArray(assets.variantId, test.variantIds));
  const pv: PreflightVariant[] = vrows.map((v) => ({
    id: v.id,
    label: v.label,
    specHash: v.specHash,
    // Text a viewer reads: copy (minus the CTA enum) and string variables (minus colours and URLs).
    texts: [v.copy.primaryText, v.copy.headline, v.copy.description, ...Object.values(v.variables)].filter(
      (x): x is string =>
        typeof x === "string" && x !== "" && !/^(#[0-9a-f]{6}|https?:\/\/|assets\/)/i.test(x),
    ),
    headline: v.copy.headline ?? "",
    primaryText: v.copy.primaryText ?? "",
    aspectRatios: v.aspectRatios,
    renderedAspects: arows.filter((a) => a.variantId === v.id).map((a) => a.aspect),
  }));
  const supported = Object.fromEntries(
    vrows.map((v) => [v.id, getTemplate(v.templateId)?.aspectRatios ?? []]),
  );
  const { check: budget } = await budgetCheckFor(ctx, test, brief);
  const page = await ctx.checkUrl(brief.productUrl);
  const event = await ctx.platform.sendTestEvent(brief.conversionEvent, brief.productUrl);
  const checks = [
    ...checkPolicy(
      pv,
      ctx.policies.filter((p) => p.platform === test.platform || p.platform === "all"),
    ),
    ...checkSpecs(pv, supported),
    ...checkDuplicates(pv),
    ...checkNaming(
      test.id,
      vrows.map((v) => ({ id: v.id, label: v.label })),
    ),
    { check: "budget", ok: budget.allowed, severity: "error" as const, message: budget.reason },
    {
      check: "tracking:landing-page",
      ok: page.loads && page.hasPixel,
      severity: "error" as const,
      message: page.detail,
    },
    { check: "tracking:test-event", ok: event.received, severity: "error" as const, message: event.detail },
  ];
  const ok = preflightOk(checks);
  const report: PreflightReport = { testId, ok, checks, ranAt: ctx.now().toISOString() };
  await ctx.db
    .update(tests)
    .set({ status: ok ? "ready" : "preflight_failed", preflight: report })
    .where(eq(tests.id, testId));
  await audit(ctx, actor, ok ? "test.preflight_passed" : "test.preflight_failed", "test", testId, {
    failed: checks.filter((c) => !c.ok && c.severity === "error").length,
  });
  return report;
}

/** Stage 7a: request launch. Never spends; creates a pending approval for a human. */
export async function requestLaunch(ctx: Ctx, actor: Actor, testId: string) {
  const test = await requireTest(ctx, testId);
  const existing = await ctx.db
    .select()
    .from(approvals)
    .where(
      and(
        eq(approvals.kind, "launch_test"),
        eq(approvals.status, "pending"),
        sql`${approvals.actionPayload}->>'testId' = ${testId}`,
      ),
    );
  if (existing[0]) return { status: "pending_approval" as const, approval: toApproval(existing[0]) };
  // "launching" means a previously approved launch failed partway; re-launching is safe (writes are idempotent).
  if (test.status !== "ready" && test.status !== "launching")
    throw conflict(`Test is ${test.status}; run \`adlab test preflight\` until it passes`);
  const brief = await requireBrief(ctx, test.briefId);
  const { check } = await budgetCheckFor(ctx, test, brief);
  if (!check.allowed) throw blocked(check.reason, check);
  const id = newId("apr");
  const [row] = await ctx.db
    .insert(approvals)
    .values({
      id,
      kind: "launch_test",
      title: `Launch stage ${test.stage} test: ${test.variantIds.length} variants for ${brief.product}`,
      summary: `${STRUCTURE}. Lifetime budget $${(test.budgetCents / 100).toFixed(2)} over ${test.durationHours}h. After approval: brief week committed $${((check.briefCommittedCents + test.budgetCents) / 100).toFixed(2)} of $${(brief.weeklyCapCents / 100).toFixed(2)}.`,
      amountCents: test.budgetCents,
      actionPayload: { testId },
      requestedBy: actor.name,
      idempotencyKey: `launch:${testId}:${id}`,
      createdAt: ctx.now(),
    })
    .returning();
  await ctx.db.update(tests).set({ status: "pending_approval" }).where(eq(tests.id, testId));
  await audit(ctx, actor, "test.launch_requested", "test", testId, {
    approvalId: id,
    amountCents: test.budgetCents,
  });
  return { status: "pending_approval" as const, approval: toApproval(row!) };
}

/**
 * Idempotent platform write: registry first, then a platform lookup by name (which embeds IDs),
 * then create; a timeout after create is recovered by looking up again. Never creates duplicates.
 */
export async function ensureObject(
  ctx: Ctx,
  o: {
    testId: string;
    variantId: string | null;
    kind: PlatformKind;
    label: string;
    parentExternalId?: string;
    lifetimeBudgetCents?: number;
    endTime?: string;
    conversionEvent?: string;
    creative?: CreativeInput;
  },
) {
  const key = idempotencyKey(o.testId, o.variantId, o.kind);
  const [known] = await ctx.db.select().from(platformObjects).where(eq(platformObjects.idempotencyKey, key));
  if (known) return known;
  const name = encodeName({ testId: o.testId, variantId: o.variantId, kind: o.kind, label: o.label });
  const record = async (state: { externalId: string; status: string }) => {
    const [row] = await ctx.db
      .insert(platformObjects)
      .values({
        id: newId("plo"),
        platform: ctx.platform.platform,
        externalId: state.externalId,
        kind: o.kind,
        parentId: o.parentExternalId ?? null,
        variantId: o.variantId,
        testId: o.testId,
        name,
        status: state.status,
        budgetCents: o.lifetimeBudgetCents ?? null,
        idempotencyKey: key,
        createdAt: ctx.now(),
      })
      .returning();
    return row!;
  };
  const found = await ctx.platform.findByName(o.kind, name);
  if (found) return record(found);
  try {
    return record(
      await ctx.platform.createObject({
        kind: o.kind,
        idempotencyKey: key,
        name,
        parentExternalId: o.parentExternalId,
        lifetimeBudgetCents: o.lifetimeBudgetCents,
        endTime: o.endTime,
        conversionEvent: o.conversionEvent,
        creative: o.creative,
      }),
    );
  } catch (err) {
    const after = await ctx.platform.findByName(o.kind, name);
    if (after) return record(after);
    throw err;
  }
}

/** Stage 7b: runs only after a human approved. Re-checks the governor, then builds and activates. */
export async function executeLaunch(ctx: Ctx, actor: Actor, testId: string) {
  const test = await requireTest(ctx, testId);
  if (!["pending_approval", "launching"].includes(test.status)) throw conflict(`Test is ${test.status}`);
  const brief = await requireBrief(ctx, test.briefId);
  const { check, week, account } = await budgetCheckFor(ctx, test, brief);
  const [alreadyCommitted] = await ctx.db
    .select()
    .from(spendLedger)
    .where(and(eq(spendLedger.testId, test.id), eq(spendLedger.weekStart, week)));
  // The kill switch blocks every launch, including a retry of one already committed to the ledger.
  if ((await getKillSwitch(ctx)).engaged) throw blocked("Kill switch is engaged");
  if (!alreadyCommitted && !check.allowed) throw blocked(check.reason, check);

  await ctx.db.update(tests).set({ status: "launching" }).where(eq(tests.id, testId));
  if (!alreadyCommitted) {
    await ctx.db.insert(spendLedger).values({
      id: newId("led"),
      account,
      briefId: brief.id,
      testId: test.id,
      weekStart: week,
      committedCents: test.budgetCents,
      actualCents: 0,
      updatedAt: ctx.now(),
    });
  }

  const vrows = await ctx.db.select().from(variants).where(inArray(variants.id, test.variantIds));
  const arows = await ctx.db.select().from(assets).where(inArray(assets.variantId, test.variantIds));
  const endTime = addHours(ctx.now(), test.durationHours).toISOString();
  const campaign = await ensureObject(ctx, {
    testId,
    variantId: null,
    kind: "campaign",
    label: `stage${test.stage} ${brief.product}`,
  });
  const budgets = splitBudget(test.budgetCents, test.variantIds.length);
  const created = [campaign];
  for (const [i, variantId] of test.variantIds.entries()) {
    const v = vrows.find((r) => r.id === variantId)!;
    const asset =
      arows.find((a) => a.variantId === v.id && a.aspect === v.aspectRatios[0]) ??
      arows.find((a) => a.variantId === v.id);
    if (!asset) throw invalid(`Variant ${v.id} has no rendered asset`);
    const adset = await ensureObject(ctx, {
      testId,
      variantId: v.id,
      kind: "adset",
      label: v.label,
      parentExternalId: campaign.externalId,
      lifetimeBudgetCents: budgets[i]!,
      endTime,
      conversionEvent: brief.conversionEvent,
    });
    const ad = await ensureObject(ctx, {
      testId,
      variantId: v.id,
      kind: "ad",
      label: v.label,
      parentExternalId: adset.externalId,
      creative: {
        assetUrl: ctx.storage.url(asset.storageKey),
        assetPath: ctx.storage.localPath(asset.storageKey) ?? undefined,
        aspect: asset.aspect,
        copy: v.copy as never,
        destinationUrl: trackedUrl(brief.productUrl, {
          platform: test.platform,
          testId,
          variantId: v.id,
          hypothesisId: v.hypothesisId,
        }),
      },
    });
    created.push(adset, ad);
  }
  // Activate bottom-up so nothing delivers until the whole structure exists.
  for (const kind of ["ad", "adset", "campaign"]) {
    for (const o of created.filter((c) => c.kind === kind && c.status !== "ACTIVE")) {
      await ctx.platform.setStatus(o.externalId, "ACTIVE");
      await ctx.db.update(platformObjects).set({ status: "ACTIVE" }).where(eq(platformObjects.id, o.id));
    }
  }
  await ctx.db.update(variants).set({ status: "live" }).where(inArray(variants.id, test.variantIds));
  await ctx.db.update(tests).set({ status: "running", startedAt: ctx.now() }).where(eq(tests.id, testId));
  await audit(ctx, actor, "test.launched", "test", testId, {
    summary: `stage ${test.stage}, ${test.variantIds.length} variants, $${(test.budgetCents / 100).toFixed(2)}`,
    objects: created.length,
  });
  return toTest(await requireTest(ctx, testId));
}
