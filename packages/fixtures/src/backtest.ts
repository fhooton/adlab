import { type ArmInput, encodeName, evaluate, idempotencyKey, ruleSetFor, splitBudget } from "@adlab/core";
import { FakeAdPlatform } from "./fake-platform";
import { makeScenario } from "./scenario";

export interface BacktestResult {
  ruleVersion: string;
  scenarios: number;
  /** Share of scenarios where the true best arm was promoted/scaled (or survived to the end). */
  winnerRecall: number;
  /** Share of scenarios where the true best arm was killed. Should be near zero. */
  winnerKilledRate: number;
  /** Average share of the budget spent on arms that were eventually killed. */
  wastedSpendShare: number;
  /** Average total spend / budget. Must never exceed 1. */
  maxBudgetUtilisation: number;
}

/**
 * Decision backtest: run the rules engine on simulated campaigns with known winners.
 * Pure simulation (no DB): fake platform + rules engine, stepping 6 simulated hours at a time.
 */
export async function runBacktest(opts: {
  stage: 1 | 2;
  scenarios: number;
  seed?: number;
  budgetCents?: number;
  arms?: number;
}): Promise<BacktestResult> {
  const rs = ruleSetFor(opts.stage);
  const budget = opts.budgetCents ?? (opts.stage === 1 ? 30_000 : 120_000);
  const durationHours = 72;
  let recall = 0;
  let winnerKilled = 0;
  let wasted = 0;
  let maxUtil = 0;

  for (let s = 0; s < opts.scenarios; s++) {
    const scenario = makeScenario((opts.seed ?? 1) * 1000 + s, opts.arms ?? 6);
    const fake = new FakeAdPlatform({ seed: scenario.seed });
    const testId = `tst_bt${String(s).padStart(6, "0")}`;
    const campaign = await fake.createObject({
      kind: "campaign",
      idempotencyKey: idempotencyKey(testId, "c"),
      name: encodeName({ testId, variantId: null, kind: "campaign", label: "bt" }),
    });
    const budgets = splitBudget(budget, scenario.arms.length);
    const arms = await Promise.all(
      scenario.arms.map(async (arm, i) => {
        const variantId = `var_${arm.key}${String(s).padStart(4, "0")}`;
        fake.setTruth(variantId, arm.truth);
        const adset = await fake.createObject({
          kind: "adset",
          idempotencyKey: idempotencyKey(testId, variantId, "s"),
          name: encodeName({ testId, variantId, kind: "adset", label: arm.key }),
          parentExternalId: campaign.externalId,
          lifetimeBudgetCents: budgets[i]!,
        });
        const ad = await fake.createObject({
          kind: "ad",
          idempotencyKey: idempotencyKey(testId, variantId, "a"),
          name: encodeName({ testId, variantId, kind: "ad", label: arm.key }),
          parentExternalId: adset.externalId,
          creative: {
            assetUrl: "x",
            aspect: "9:16",
            destinationUrl: "https://example.com",
            copy: { primaryText: "x", headline: "x", cta: "SHOP_NOW" },
          },
        });
        return { variantId, adId: ad.externalId, adsetId: adset.externalId, active: true };
      }),
    );
    for (const o of [campaign.externalId, ...arms.flatMap((a) => [a.adsetId, a.adId])])
      await fake.setStatus(o, "ACTIVE");

    const killedSpend = new Map<string, number>();
    let lastEval: ReturnType<typeof evaluate> | null = null;
    for (let hours = 6; hours <= durationHours; hours += 6) {
      fake.advance(6);
      const insights = await fake.getInsights(
        arms.map((a) => a.adId),
        "purchase",
      );
      const inputs: ArmInput[] = arms.map((a, i) => ({
        variantId: a.variantId,
        isControl: i === 0,
        active: a.active,
        metrics: insights.find((r) => r.externalId === a.adId)!.metrics,
      }));
      lastEval = evaluate(rs, inputs, { budgetCents: budget, hoursElapsed: hours, durationHours });
      for (const p of lastEval.proposals) {
        if (p.action !== "kill") continue;
        const arm = arms.find((a) => a.variantId === p.variantId)!;
        arm.active = false;
        await fake.setStatus(arm.adId, "PAUSED");
        killedSpend.set(arm.variantId, 0);
      }
      if (lastEval.complete) break;
    }
    const final = await fake.getInsights(
      arms.map((a) => a.adId),
      "purchase",
    );
    const total = final.reduce((sum, r) => sum + r.metrics.spendCents, 0);
    for (const vid of killedSpend.keys()) {
      const arm = arms.find((a) => a.variantId === vid)!;
      killedSpend.set(vid, final.find((r) => r.externalId === arm.adId)!.metrics.spendCents);
    }
    const bestIdx = opts.stage === 1 ? scenario.bestHookIdx : scenario.bestConvIdx;
    const best = arms[bestIdx]!;
    const winners = new Set(
      (lastEval?.proposals ?? [])
        .filter((p) => p.action === "promote" || p.action === "scale")
        .map((p) => p.variantId),
    );
    if (winners.has(best.variantId) || (winners.size === 0 && best.active)) recall++;
    if (!best.active) winnerKilled++;
    wasted += [...killedSpend.values()].reduce((a, b) => a + b, 0) / budget;
    maxUtil = Math.max(maxUtil, total / budget);
  }

  return {
    ruleVersion: rs.version,
    scenarios: opts.scenarios,
    winnerRecall: recall / opts.scenarios,
    winnerKilledRate: winnerKilled / opts.scenarios,
    wastedSpendShare: wasted / opts.scenarios,
    maxBudgetUtilisation: maxUtil,
  };
}
