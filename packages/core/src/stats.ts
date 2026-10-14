import { beta, createRng } from "./rng";

/**
 * Honest statistics: Beta-Binomial posteriors with a uniform prior. Comparisons use posterior
 * probability, not raw thresholds, so early noise does not kill good variants.
 */
export interface Arm {
  id: string;
  successes: number;
  trials: number;
}

export function posteriorMean(arm: Arm): number {
  return (arm.successes + 1) / (arm.trials + 2);
}

/** Central credible interval using a normal approximation to the Beta posterior. */
export function credibleInterval(arm: Arm, z = 1.645): { mean: number; low: number; high: number } {
  const a = arm.successes + 1;
  const b = arm.trials - arm.successes + 1;
  const mean = a / (a + b);
  const sd = Math.sqrt((a * b) / ((a + b) ** 2 * (a + b + 1)));
  return { mean, low: Math.max(0, mean - z * sd), high: Math.min(1, mean + z * sd) };
}

/**
 * P(each arm has the highest true rate), by Monte Carlo over the posteriors.
 * Deterministic: the seed is derived from the inputs, so the same data gives the same answer.
 */
export function probabilityBest(arms: Arm[], draws = 4000): Record<string, number> {
  const result: Record<string, number> = {};
  if (arms.length === 0) return result;
  for (const arm of arms) result[arm.id] = 0;
  if (arms.length === 1) {
    result[arms[0]!.id] = 1;
    return result;
  }
  const seed = arms.reduce((s, a) => (s * 31 + a.successes * 7 + a.trials) >>> 0, 17);
  const rng = createRng(seed);
  const wins = new Array<number>(arms.length).fill(0);
  for (let d = 0; d < draws; d++) {
    let best = -1;
    let bestIdx = 0;
    for (let i = 0; i < arms.length; i++) {
      const arm = arms[i]!;
      const sample = beta(rng, arm.successes + 1, arm.trials - arm.successes + 1);
      if (sample > best) {
        best = sample;
        bestIdx = i;
      }
    }
    wins[bestIdx]!++;
  }
  arms.forEach((arm, i) => {
    result[arm.id] = wins[i]! / draws;
  });
  return result;
}
