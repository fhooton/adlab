import { describe, expect, it } from "vitest";
import { addHours, binomial, createRng, gamma, seedFrom } from "../src";

describe("rng", () => {
  it("is reproducible from a seed", () => {
    const a = createRng(seedFrom("demo"));
    const b = createRng(seedFrom("demo"));
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("binomial stays within [0, n] and near the mean", () => {
    const rng = createRng(1);
    expect(binomial(rng, 0, 0.5)).toBe(0);
    expect(binomial(rng, 10, 1)).toBe(10);
    expect(binomial(rng, 10, 0)).toBe(0);
    const small = binomial(rng, 50, 0.5);
    expect(small).toBeGreaterThanOrEqual(0);
    expect(small).toBeLessThanOrEqual(50);
    const draws = Array.from({ length: 200 }, () => binomial(rng, 10_000, 0.3));
    const mean = draws.reduce((s, x) => s + x, 0) / draws.length;
    expect(mean).toBeGreaterThan(2900);
    expect(mean).toBeLessThan(3100);
  });

  it("gamma handles shape < 1", () => {
    const rng = createRng(2);
    const x = gamma(rng, 0.5);
    expect(x).toBeGreaterThan(0);
  });

  it("adds hours", () => {
    expect(addHours(new Date("2026-01-01T00:00:00Z"), 25).toISOString()).toBe("2026-01-02T01:00:00.000Z");
  });
});
