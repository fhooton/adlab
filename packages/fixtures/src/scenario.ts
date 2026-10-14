import { createRng } from "@adlab/core";
import type { TrueRates } from "./fake-platform";

export interface ScenarioArm {
  key: string;
  truth: TrueRates;
}

export interface Scenario {
  seed: number;
  arms: ScenarioArm[];
  /** Index of the arm with the highest true hook rate (stage 1) */
  bestHookIdx: number;
  /** Index of the arm with the highest true conversions per impression (stage 2) */
  bestConvIdx: number;
}

/**
 * Seeded scenario generator: same seed, same scenario, so failures reproduce.
 * One arm gets a planted lift so there is a known true winner.
 */
export function makeScenario(seed: number, armCount = 6, lift = 1.35): Scenario {
  const rng = createRng(seed);
  const arms: ScenarioArm[] = Array.from({ length: armCount }, (_, i) => ({
    key: `arm${i}`,
    truth: {
      hookRate: 0.2 + rng() * 0.08,
      holdRate: 0.2 + rng() * 0.1,
      ctr: 0.008 + rng() * 0.004,
      cvr: 0.03 + rng() * 0.015,
      cpmCents: 900 + Math.round(rng() * 300),
    },
  }));
  const winner = Math.floor(rng() * armCount);
  const w = arms[winner]!.truth;
  w.hookRate *= lift;
  w.ctr *= lift;
  const score = (t: TrueRates) => t.ctr * t.cvr;
  const bestHookIdx = arms.reduce(
    (best, a, i) => (a.truth.hookRate > arms[best]!.truth.hookRate ? i : best),
    0,
  );
  const bestConvIdx = arms.reduce((best, a, i) => (score(a.truth) > score(arms[best]!.truth) ? i : best), 0);
  return { seed, arms, bestHookIdx, bestConvIdx };
}
