import { platformObjects } from "@adlab/db";
import { describe, expect, it } from "vitest";
import {
  addLearning,
  createBrief,
  createTest,
  createVariants,
  decideApproval,
  decideTest,
  digest,
  drainJobs,
  engageKillSwitch,
  getTestResults,
  listApprovals,
  overview,
  proposeHypotheses,
  reconcile,
  requestLaunch,
  requestRenders,
  runPreflight,
  simAdvance,
  syncTemplates,
  syncTest,
} from "../src";
import { agent, briefInput, generator, human, testContext, variantSet } from "./helpers";

async function selectedHypothesis(ctx: Awaited<ReturnType<typeof testContext>>["ctx"]) {
  await syncTemplates(ctx);
  const brief = await createBrief(ctx, agent, briefInput);
  const { hypotheses, approval } = await proposeHypotheses(ctx, agent, {
    briefId: brief.id,
    hypotheses: [
      {
        concept: "time-saving",
        persona: "busy-parent",
        format: "motion_graphic",
        rationale: "Top competitor ads lead with time",
      },
      { concept: "price", persona: "budget-shopper", format: "motion_graphic", rationale: "Offer is strong" },
    ],
  });
  await decideApproval(ctx, human, {
    approvalId: approval.id,
    version: approval.version,
    decision: "approve",
    selection: [hypotheses[0]!.id],
  });
  return { brief, hypothesis: hypotheses[0]!, rejected: hypotheses[1]! };
}

async function launchedTest(
  t: Awaited<ReturnType<typeof testContext>>,
  budgetCents = 30_000,
  hooks = ["Dinner in 30 minutes.", "No more 6pm panic.", "Kids eat the veggies.", "Skip the grocery run."],
) {
  const { ctx, fake } = t;
  const { brief, hypothesis } = await selectedHypothesis(ctx);
  const variants = await createVariants(ctx, agent, {
    hypothesisId: hypothesis.id,
    generator,
    variants: variantSet(hooks),
  });
  await requestRenders(
    ctx,
    agent,
    variants.map((v) => v.id),
  );
  await drainJobs(ctx);
  const test = await createTest(ctx, agent, {
    briefId: brief.id,
    stage: 1,
    variantIds: variants.map((v) => v.id),
    budgetCents,
    durationHours: 72,
  });
  const report = await runPreflight(ctx, agent, test.id);
  expect(report.ok, JSON.stringify(report.checks.filter((c) => !c.ok))).toBe(true);
  const launch = await requestLaunch(ctx, agent, test.id);
  await decideApproval(ctx, human, {
    approvalId: launch.approval.id,
    version: launch.approval.version,
    decision: "approve",
  });
  return { brief, variants, test, fake };
}

describe("full simulated loop", () => {
  it("brief → angles → variants → render → preflight → approve → launch → measure → decide → learn", async () => {
    const t = await testContext({ ADLAB_AUTO_APPLY: "kill" });
    const { ctx, fake } = t;
    const { variants, test } = await launchedTest(t);
    // Pin every arm's true rates (ids are random, so defaults would vary run to run):
    // one known dud for the engine to kill and one clear winner.
    const truth = (hookRate: number) => ({ hookRate, holdRate: 0.25, ctr: 0.01, cvr: 0.04, cpmCents: 1000 });
    for (const [i, rate] of [0.25, 0.36, 0.08, 0.24].entries()) fake.setTruth(variants[i]!.id, truth(rate));

    const objects = await ctx.db.select().from(platformObjects);
    expect(objects).toHaveLength(1 + 2 * variants.length);
    expect(objects.every((o) => o.status === "ACTIVE")).toBe(true);
    expect(objects.filter((o) => o.kind === "adset").reduce((s, o) => s + (o.budgetCents ?? 0), 0)).toBe(
      30_000,
    );

    await simAdvance(ctx, agent, 24);
    await syncTest(ctx, agent, test.id);
    const d1 = await decideTest(ctx, agent, test.id);
    expect(d1.autoApplied.length).toBeGreaterThanOrEqual(1);

    await simAdvance(ctx, agent, 60);
    await syncTest(ctx, agent, test.id);
    const d2 = await decideTest(ctx, agent, test.id);
    expect(d2.complete).toBe(true);
    expect(
      [...d1.pendingApproval, ...d2.pendingApproval].some(
        (d) => d.action === "promote" && d.variantId === variants[1]!.id,
      ),
    ).toBe(true);

    const pending = (await listApprovals(ctx, "pending")).find((a) => a.kind === "apply_decisions")!;
    await decideApproval(ctx, human, {
      approvalId: pending.id,
      version: pending.version,
      decision: "approve",
    });

    const results = await getTestResults(ctx, test.id);
    expect(results.test.status).toBe("ended");
    expect(results.totalSpendCents).toBeLessThanOrEqual(30_000);
    expect(results.variants.find((v) => v.variantId === variants[2]!.id)?.latestDecision?.action).toBe(
      "kill",
    );
    expect(results.variants.find((v) => v.variantId === variants[1]!.id)?.latestDecision?.action).toBe(
      "promote",
    );

    const learning = await addLearning(ctx, agent, {
      statement: "Panic-framed hooks beat time-saving claims for busy parents",
      evidenceIds: [test.id],
      confidence: "low",
    });
    expect(learning.status).toBe("active");

    const ov = await overview(ctx);
    expect(ov.week.committedCents).toBe(30_000);
    expect(ov.costPerVariantTestedCents).toBeGreaterThan(0);
    const dg = await digest(ctx, 24 * 7);
    expect(dg.launched).toHaveLength(1);
    expect(dg.killed.length).toBeGreaterThanOrEqual(1);
  });
});

describe("safety", () => {
  it("agents cannot approve their own spend", async () => {
    const { ctx } = await testContext();
    await syncTemplates(ctx);
    const brief = await createBrief(ctx, agent, briefInput);
    const { approval } = await proposeHypotheses(ctx, agent, {
      briefId: brief.id,
      hypotheses: [{ concept: "cc", persona: "pp", format: "ugc", rationale: "because" }],
    });
    await expect(
      decideApproval(ctx, agent, { approvalId: approval.id, version: 1, decision: "approve", selection: [] }),
    ).rejects.toThrow(/dashboard session/);
  });

  it("variants require a human-selected hypothesis and the one-variable rule", async () => {
    const { ctx } = await testContext();
    const { hypothesis, rejected } = await selectedHypothesis(ctx);
    await expect(
      createVariants(ctx, agent, { hypothesisId: rejected.id, generator, variants: variantSet(["a", "b"]) }),
    ).rejects.toThrow(/must select/);
    const bad = variantSet(["Hook one", "Hook two"]);
    bad[1]!.copy = { ...bad[1]!.copy, headline: "Different" };
    await expect(
      createVariants(ctx, agent, { hypothesisId: hypothesis.id, generator, variants: bad }),
    ).rejects.toThrow(/problem/);
  });

  it("two people approving at once produce one launch", async () => {
    const t = await testContext();
    const { ctx } = t;
    const { brief, hypothesis } = await selectedHypothesis(ctx);
    const vs = await createVariants(ctx, agent, {
      hypothesisId: hypothesis.id,
      generator,
      variants: variantSet(["A hook", "B hook"]),
    });
    await requestRenders(
      ctx,
      agent,
      vs.map((v) => v.id),
    );
    await drainJobs(ctx);
    const test = await createTest(ctx, agent, {
      briefId: brief.id,
      stage: 1,
      variantIds: vs.map((v) => v.id),
      budgetCents: 5_000,
    });
    await runPreflight(ctx, agent, test.id);
    const { approval } = await requestLaunch(ctx, agent, test.id);
    const again = await requestLaunch(ctx, agent, test.id);
    expect(again.approval.id).toBe(approval.id);
    const results = await Promise.allSettled([
      decideApproval(ctx, human, { approvalId: approval.id, version: approval.version, decision: "approve" }),
      decideApproval(
        ctx,
        { kind: "human", name: "Alex" },
        { approvalId: approval.id, version: approval.version, decision: "approve" },
      ),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await ctx.db.select().from(platformObjects)).toHaveLength(5);
  });

  it("budget governor refuses a launch over the brief cap", async () => {
    const t = await testContext();
    const { ctx } = t;
    await launchedTest(t, 50_000, ["One", "Two"]);
    const { brief, hypothesis } = await selectedHypothesis(ctx);
    const vs = await createVariants(ctx, agent, {
      hypothesisId: hypothesis.id,
      generator,
      variants: variantSet(["Three", "Four"]),
    });
    await requestRenders(
      ctx,
      agent,
      vs.map((v) => v.id),
    );
    await drainJobs(ctx);
    // Account cap is 100_000; 50_000 committed already; this brief's cap is 60_000 but account remaining is 50_000.
    const test = await createTest(ctx, agent, {
      briefId: brief.id,
      stage: 1,
      variantIds: vs.map((v) => v.id),
      budgetCents: 55_000,
    });
    const report = await runPreflight(ctx, agent, test.id);
    expect(report.checks.find((c) => c.check === "budget")?.ok).toBe(false);
    await expect(requestLaunch(ctx, agent, test.id)).rejects.toThrow(/preflight/);
  });

  it("platform timeouts after create never produce duplicate objects", async () => {
    const t = await testContext({}, { timeoutAfterCreateRate: 0.5 });
    const { test, fake } = await launchedTest(t, 10_000, ["One", "Two", "Three"]);
    const registry = await t.ctx.db.select().from(platformObjects);
    expect(fake.objects()).toHaveLength(registry.length);
    expect(registry.every((r) => r.testId === test.id)).toBe(true);
  });

  it("kill switch pauses everything and blocks new launches; reconcile flags manual edits", async () => {
    const t = await testContext();
    const { ctx, fake } = t;
    const { test } = await launchedTest(t, 10_000, ["One", "Two"]);
    const campaign = (await ctx.db.select().from(platformObjects)).find((o) => o.kind === "campaign")!;
    fake.manualEdit(campaign.externalId, { status: "PAUSED" });
    const rec = await reconcile(ctx, human);
    expect(rec.drift).toHaveLength(1);
    expect(t.sent.some((s) => s.text.includes("Drift"))).toBe(true);

    const ks = await engageKillSwitch(ctx, agent, "test");
    expect(ks.paused).toBeGreaterThan(0);
    expect(fake.objects().every((o) => o.status === "PAUSED")).toBe(true);
    await simAdvance(ctx, agent, 48);
    expect(fake.totalSpend()).toBe(0);
    const res = await getTestResults(ctx, test.id);
    expect(res.test.status).toBe("paused");
  });

  it("preflight blocks policy violations and broken tracking", async () => {
    const t = await testContext();
    const { ctx } = t;
    await syncTemplates(ctx);
    const brief = await createBrief(ctx, agent, { ...briefInput, productUrl: "https://example.com/notrack" });
    const { hypotheses, approval } = await proposeHypotheses(ctx, agent, {
      briefId: brief.id,
      hypotheses: [{ concept: "cc", persona: "pp", format: "motion_graphic", rationale: "because" }],
    });
    await decideApproval(ctx, human, {
      approvalId: approval.id,
      version: 1,
      decision: "approve",
      selection: [hypotheses[0]!.id],
    });
    const vs = await createVariants(ctx, agent, {
      hypothesisId: hypotheses[0]!.id,
      generator,
      variants: variantSet(["Are you overweight?", "Feel lighter"]),
    });
    await requestRenders(
      ctx,
      agent,
      vs.map((v) => v.id),
    );
    await drainJobs(ctx);
    const test = await createTest(ctx, agent, {
      briefId: brief.id,
      stage: 1,
      variantIds: vs.map((v) => v.id),
      budgetCents: 5_000,
    });
    const report = await runPreflight(ctx, agent, test.id);
    expect(report.ok).toBe(false);
    expect(
      report.checks.some((c) => c.check.startsWith("policy:meta-core:personal-attributes") && !c.ok),
    ).toBe(true);
    expect(report.checks.find((c) => c.check === "tracking:landing-page")?.ok).toBe(false);
  });
});

describe("launch edge cases", () => {
  it("a launch that fails partway can be re-requested and completes without duplicates", async () => {
    const t = await testContext();
    const { ctx, fake } = t;
    const { brief, hypothesis } = await selectedHypothesis(ctx);
    const vs = await createVariants(ctx, agent, {
      hypothesisId: hypothesis.id,
      generator,
      variants: variantSet(["One", "Two"]),
    });
    await requestRenders(
      ctx,
      agent,
      vs.map((v) => v.id),
    );
    await drainJobs(ctx);
    const test = await createTest(ctx, agent, {
      briefId: brief.id,
      stage: 1,
      variantIds: vs.map((v) => v.id),
      budgetCents: 5_000,
    });
    await runPreflight(ctx, agent, test.id);
    const first = await requestLaunch(ctx, agent, test.id);
    const realSetStatus = fake.setStatus.bind(fake);
    fake.setStatus = async () => {
      throw new Error("platform down");
    };
    await expect(
      decideApproval(ctx, human, {
        approvalId: first.approval.id,
        version: first.approval.version,
        decision: "approve",
      }),
    ).rejects.toThrow(/platform down/);
    fake.setStatus = realSetStatus;
    const second = await requestLaunch(ctx, agent, test.id);
    await decideApproval(ctx, human, {
      approvalId: second.approval.id,
      version: second.approval.version,
      decision: "approve",
    });
    expect(fake.objects()).toHaveLength(5);
    expect((await getTestResults(ctx, test.id)).test.status).toBe("running");
  });

  it("an engaged kill switch blocks a launch retry even after the budget was committed", async () => {
    const t = await testContext();
    const { ctx, fake } = t;
    const { brief, hypothesis } = await selectedHypothesis(ctx);
    const vs = await createVariants(ctx, agent, {
      hypothesisId: hypothesis.id,
      generator,
      variants: variantSet(["One", "Two"]),
    });
    await requestRenders(
      ctx,
      agent,
      vs.map((v) => v.id),
    );
    await drainJobs(ctx);
    const test = await createTest(ctx, agent, {
      briefId: brief.id,
      stage: 1,
      variantIds: vs.map((v) => v.id),
      budgetCents: 5_000,
    });
    await runPreflight(ctx, agent, test.id);
    const first = await requestLaunch(ctx, agent, test.id);
    const realSetStatus = fake.setStatus.bind(fake);
    fake.setStatus = async () => {
      throw new Error("platform down");
    };
    await expect(
      decideApproval(ctx, human, {
        approvalId: first.approval.id,
        version: first.approval.version,
        decision: "approve",
      }),
    ).rejects.toThrow();
    fake.setStatus = realSetStatus;
    await engageKillSwitch(ctx, human, "stop");
    // Refused at request time: no approval is even created while the kill switch is engaged.
    await expect(requestLaunch(ctx, agent, test.id)).rejects.toThrow(/Kill switch/);
    expect(fake.objects().every((o) => o.status !== "ACTIVE")).toBe(true);
  });
});
