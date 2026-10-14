import type { DecisionAction, Interval, NormalizedMetrics } from "@adlab/contracts";
import { type Arm, credibleInterval, probabilityBest } from "./stats";

/**
 * Rules engine. Pure: inputs in, proposed actions out. Every decision stores the rule version and
 * an input snapshot so it can be replayed. Rule sets are versioned: never edit one in place —
 * add a new version and point RULE_VERSION_BY_STAGE at it, so the backtest can compare them.
 */
export interface RuleSet {
  version: string;
  stage: 1 | 2;
  metric: "hookRate" | "convPerImpression";
  /** No judgment at all below these (no-peeking). */
  minImpressions: number;
  minSpendCents: number;
  /** Stage 2 only: total conversions in the test before any judgment. */
  minTotalConversions: number;
  /** Kill an arm when its interval's upper bound sits below this fraction of the leader's mean. */
  killBelowLeaderFraction: number;
  /** Kill an arm whose probability of being best is below this (stage 2). */
  killProbBest: number;
  /** Declare a winner at or above this probability of being best. */
  winProbBest: number;
  /** Stage 1: once the test is complete, promote the top N survivors to stage 2. */
  promoteTopN: number;
  /** A test is complete when this share of budget is spent, or its duration has elapsed. */
  completeAtSpendShare: number;
}

export const RULESETS: Record<string, RuleSet> = {
  "stage1-v1": {
    version: "stage1-v1",
    stage: 1,
    metric: "hookRate",
    minImpressions: 1500,
    minSpendCents: 1000,
    minTotalConversions: 0,
    killBelowLeaderFraction: 0.8,
    killProbBest: 0,
    winProbBest: 0.9,
    promoteTopN: 2,
    completeAtSpendShare: 0.85,
  },
  "stage2-v1": {
    version: "stage2-v1",
    stage: 2,
    metric: "convPerImpression",
    minImpressions: 3000,
    minSpendCents: 3000,
    minTotalConversions: 50,
    killBelowLeaderFraction: 0.5,
    killProbBest: 0.01,
    winProbBest: 0.9,
    promoteTopN: 1,
    completeAtSpendShare: 0.9,
  },
};

export const RULE_VERSION_BY_STAGE = { 1: "stage1-v1", 2: "stage2-v1" } as const;

export function ruleSetFor(stage: 1 | 2, version?: string): RuleSet {
  const rs = RULESETS[version ?? RULE_VERSION_BY_STAGE[stage]];
  if (!rs) throw new Error(`Unknown rule version ${version}`);
  if (rs.stage !== stage) throw new Error(`Rule ${rs.version} is for stage ${rs.stage}, not ${stage}`);
  return rs;
}

export interface ArmInput {
  variantId: string;
  isControl: boolean;
  active: boolean;
  metrics: NormalizedMetrics;
}

export interface TestContext {
  budgetCents: number;
  hoursElapsed: number;
  durationHours: number;
}

export interface ArmEvaluation {
  variantId: string;
  enoughEvidence: boolean;
  interval: Interval | null;
  probBest: number | null;
}

export interface Proposal {
  variantId: string;
  action: DecisionAction;
  reason: string;
}

export interface Evaluation {
  ruleVersion: string;
  complete: boolean;
  arms: ArmEvaluation[];
  proposals: Proposal[];
  inputsSnapshot: Record<string, unknown>;
}

function toArm(rs: RuleSet, a: ArmInput): Arm {
  const successes = rs.metric === "hookRate" ? a.metrics.views3s : a.metrics.conversions;
  return {
    id: a.variantId,
    successes: Math.min(successes, a.metrics.impressions),
    trials: a.metrics.impressions,
  };
}

export function evaluate(rs: RuleSet, arms: ArmInput[], ctx: TestContext): Evaluation {
  const spent = arms.reduce((s, a) => s + a.metrics.spendCents, 0);
  const complete =
    spent >= rs.completeAtSpendShare * ctx.budgetCents || ctx.hoursElapsed >= ctx.durationHours;
  const totalConversions = arms.reduce((s, a) => s + a.metrics.conversions, 0);
  const testHasEvidence = totalConversions >= rs.minTotalConversions;

  const enough = (a: ArmInput) =>
    testHasEvidence && a.metrics.impressions >= rs.minImpressions && a.metrics.spendCents >= rs.minSpendCents;

  // Probability-of-best is computed among arms still competing (active), with enough evidence.
  const competing = arms.filter((a) => a.active && enough(a));
  const pBest = probabilityBest(competing.map((a) => toArm(rs, a)));
  const intervals = new Map(
    arms.map((a) => [a.variantId, a.metrics.impressions > 0 ? credibleInterval(toArm(rs, a)) : null]),
  );
  const leaderMean = Math.max(0, ...competing.map((a) => intervals.get(a.variantId)?.mean ?? 0));

  const evaluations: ArmEvaluation[] = arms.map((a) => ({
    variantId: a.variantId,
    enoughEvidence: enough(a),
    interval: intervals.get(a.variantId) ?? null,
    probBest: a.variantId in pBest ? pBest[a.variantId]! : null,
  }));

  const proposals: Proposal[] = [];
  const ranked = [...competing].sort((x, y) => (pBest[y.variantId] ?? 0) - (pBest[x.variantId] ?? 0));
  const killed = new Set<string>();

  for (const a of arms) {
    if (!a.active) continue;
    const iv = intervals.get(a.variantId);
    if (!enough(a) || !iv) {
      proposals.push({
        variantId: a.variantId,
        action: "hold",
        reason: "Need more data: below minimum evidence",
      });
      continue;
    }
    const p = pBest[a.variantId] ?? 0;
    if (competing.length > 1 && iv.high < rs.killBelowLeaderFraction * leaderMean) {
      killed.add(a.variantId);
      proposals.push({
        variantId: a.variantId,
        action: "kill",
        reason: `Clearly behind leader: upper bound ${(iv.high * 100).toFixed(2)}% < ${rs.killBelowLeaderFraction} × leader ${(leaderMean * 100).toFixed(2)}%`,
      });
      continue;
    }
    if (rs.killProbBest > 0 && competing.length > 1 && p < rs.killProbBest) {
      killed.add(a.variantId);
      proposals.push({
        variantId: a.variantId,
        action: "kill",
        reason: `P(best) ${(p * 100).toFixed(1)}% < ${rs.killProbBest * 100}%`,
      });
    }
  }

  const survivors = ranked.filter((a) => !killed.has(a.variantId));
  for (const a of arms) {
    if (!a.active || killed.has(a.variantId) || !enough(a)) continue;
    const p = pBest[a.variantId] ?? 0;
    const rank = survivors.findIndex((s) => s.variantId === a.variantId);
    if (rs.stage === 2 && p >= rs.winProbBest) {
      proposals.push({
        variantId: a.variantId,
        action: "scale",
        reason: `Winner: P(best) ${(p * 100).toFixed(1)}% ≥ ${rs.winProbBest * 100}%`,
      });
    } else if (rs.stage === 1 && (p >= rs.winProbBest || (complete && rank >= 0 && rank < rs.promoteTopN))) {
      proposals.push({
        variantId: a.variantId,
        action: "promote",
        reason:
          p >= rs.winProbBest
            ? `Clear leader: P(best) ${(p * 100).toFixed(1)}%`
            : `Test complete; rank ${rank + 1} of ${survivors.length} survivors`,
      });
    } else {
      proposals.push({
        variantId: a.variantId,
        action: "hold",
        reason: complete
          ? `Not significant: P(best) ${(p * 100).toFixed(1)}%`
          : `Still running: P(best) ${(p * 100).toFixed(1)}%`,
      });
    }
  }

  return {
    ruleVersion: rs.version,
    complete,
    arms: evaluations,
    proposals,
    inputsSnapshot: { arms, ctx, ruleSet: rs },
  };
}

export type AutoApplyPolicy = ReadonlySet<DecisionAction>;

/** Promote and scale always need a human. Only kill (and no-op hold) may ever be auto-applied. */
export function parseAutoApply(raw: string | undefined): AutoApplyPolicy {
  const allowed = new Set<DecisionAction>();
  for (const part of (raw ?? "").split(",").map((s) => s.trim())) {
    if (part === "kill" || part === "hold") allowed.add(part);
  }
  return allowed;
}

export function partitionProposals(proposals: Proposal[], policy: AutoApplyPolicy) {
  const autoApply: Proposal[] = [];
  const needsApproval: Proposal[] = [];
  const noop: Proposal[] = [];
  for (const p of proposals) {
    if (p.action === "hold") noop.push(p);
    else if (p.action === "kill" && policy.has("kill")) autoApply.push(p);
    else needsApproval.push(p);
  }
  return { autoApply, needsApproval, noop };
}
