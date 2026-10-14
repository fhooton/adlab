import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  type ArmInput,
  credibleInterval,
  evaluate,
  parseAutoApply,
  partitionProposals,
  probabilityBest,
  ruleSetFor,
} from "../src";

const arm = (
  variantId: string,
  impressions: number,
  views3s: number,
  extra: Partial<ArmInput["metrics"]> = {},
  active = true,
): ArmInput => ({
  variantId,
  isControl: variantId === "var_ctrl00",
  active,
  metrics: {
    impressions,
    views3s,
    spendCents: impressions,
    views15s: 0,
    clicks: 0,
    conversions: 0,
    ...extra,
  },
});

const ctx = { budgetCents: 100_000, hoursElapsed: 24, durationHours: 72 };

describe("stats", () => {
  it("probability of best sums to one and favours the better arm", () => {
    const p = probabilityBest([
      { id: "a", successes: 300, trials: 1000 },
      { id: "b", successes: 200, trials: 1000 },
    ]);
    expect(p.a! + p.b!).toBeCloseTo(1, 5);
    expect(p.a!).toBeGreaterThan(0.99);
  });

  it("is deterministic for the same inputs", () => {
    const arms = [
      { id: "a", successes: 30, trials: 100 },
      { id: "b", successes: 28, trials: 100 },
    ];
    expect(probabilityBest(arms)).toEqual(probabilityBest(arms));
  });

  it("handles zero and one arm", () => {
    expect(probabilityBest([])).toEqual({});
    expect(probabilityBest([{ id: "a", successes: 0, trials: 0 }])).toEqual({ a: 1 });
  });

  it("credible interval brackets the mean and narrows with data", () => {
    const small = credibleInterval({ id: "a", successes: 3, trials: 10 });
    const big = credibleInterval({ id: "a", successes: 300, trials: 1000 });
    expect(small.low).toBeLessThan(small.mean);
    expect(small.high).toBeGreaterThan(small.mean);
    expect(big.high - big.low).toBeLessThan(small.high - small.low);
  });
});

describe("rules engine: stage 1", () => {
  const rs = ruleSetFor(1);

  it("holds everything below minimum evidence (no peeking)", () => {
    const ev = evaluate(rs, [arm("var_ctrl00", 500, 400), arm("var_bbbbbb", 500, 10)], ctx);
    expect(ev.proposals.every((p) => p.action === "hold")).toBe(true);
    expect(ev.arms.every((a) => !a.enoughEvidence)).toBe(true);
  });

  it("kills a clear dud once evidence is in", () => {
    const ev = evaluate(
      rs,
      [arm("var_ctrl00", 5000, 1500), arm("var_bbbbbb", 5000, 600), arm("var_cccccc", 5000, 1450)],
      ctx,
    );
    expect(ev.proposals.find((p) => p.variantId === "var_bbbbbb")?.action).toBe("kill");
    expect(ev.proposals.find((p) => p.variantId === "var_ctrl00")?.action).not.toBe("kill");
  });

  it("promotes top survivors when the test is complete", () => {
    const ev = evaluate(
      rs,
      [arm("var_ctrl00", 5000, 1500), arm("var_bbbbbb", 5000, 1480), arm("var_cccccc", 5000, 1400)],
      { ...ctx, hoursElapsed: 72 },
    );
    expect(ev.complete).toBe(true);
    const promoted = ev.proposals.filter((p) => p.action === "promote").map((p) => p.variantId);
    expect(promoted).toHaveLength(2);
    expect(promoted).toContain("var_ctrl00");
  });

  it("ignores inactive (already killed) arms", () => {
    const ev = evaluate(rs, [arm("var_ctrl00", 5000, 1500), arm("var_bbbbbb", 5000, 100, {}, false)], ctx);
    expect(ev.proposals.map((p) => p.variantId)).toEqual(["var_ctrl00"]);
  });

  it("rejects mismatched stage and unknown versions", () => {
    expect(() => ruleSetFor(2, "stage1-v1")).toThrow();
    expect(() => ruleSetFor(1, "nope")).toThrow();
  });
});

describe("rules engine: stage 2", () => {
  const rs = ruleSetFor(2);
  const conv = (id: string, impressions: number, conversions: number) =>
    arm(id, impressions, 0, { conversions, spendCents: impressions * 2 });

  it("waits for minimum total conversions", () => {
    const ev = evaluate(rs, [conv("var_ctrl00", 10_000, 10), conv("var_bbbbbb", 10_000, 5)], ctx);
    expect(ev.proposals.every((p) => p.action === "hold")).toBe(true);
  });

  it("proposes scaling a clear winner and killing a clear loser", () => {
    const ev = evaluate(
      rs,
      [conv("var_ctrl00", 20_000, 120), conv("var_bbbbbb", 20_000, 40), conv("var_cccccc", 20_000, 70)],
      ctx,
    );
    expect(ev.proposals.find((p) => p.variantId === "var_ctrl00")?.action).toBe("scale");
    expect(ev.proposals.find((p) => p.variantId === "var_bbbbbb")?.action).toBe("kill");
  });

  it("invariant: never proposes for inactive arms; at most one scale", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            impressions: fc.integer({ min: 0, max: 50_000 }),
            conv: fc.integer({ min: 0, max: 400 }),
            active: fc.boolean(),
          }),
          { minLength: 2, maxLength: 6 },
        ),
        (rows) => {
          const arms = rows.map((r, i) => ({
            ...conv(`var_arm${String(i).padStart(4, "0")}`, r.impressions, Math.min(r.conv, r.impressions)),
            active: r.active,
          }));
          const ev = evaluate(rs, arms, ctx);
          const inactive = new Set(arms.filter((a) => !a.active).map((a) => a.variantId));
          return (
            ev.proposals.every((p) => !inactive.has(p.variantId)) &&
            ev.proposals.filter((p) => p.action === "scale").length <= 1
          );
        },
      ),
      { numRuns: 60 },
    );
  });
});

describe("auto-apply policy", () => {
  it("never auto-applies promote or scale, whatever the config says", () => {
    const policy = parseAutoApply("kill,promote,scale,hold");
    expect([...policy].sort()).toEqual(["hold", "kill"]);
    const { autoApply, needsApproval, noop } = partitionProposals(
      [
        { variantId: "a", action: "kill", reason: "" },
        { variantId: "b", action: "scale", reason: "" },
        { variantId: "c", action: "promote", reason: "" },
        { variantId: "d", action: "hold", reason: "" },
      ],
      policy,
    );
    expect(autoApply.map((p) => p.variantId)).toEqual(["a"]);
    expect(needsApproval.map((p) => p.variantId)).toEqual(["b", "c"]);
    expect(noop.map((p) => p.variantId)).toEqual(["d"]);
  });

  it("routes kills to approval when not allowed", () => {
    const { needsApproval } = partitionProposals(
      [{ variantId: "a", action: "kill", reason: "" }],
      parseAutoApply(""),
    );
    expect(needsApproval).toHaveLength(1);
  });
});
