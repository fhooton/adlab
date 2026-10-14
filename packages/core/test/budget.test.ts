import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { checkBudget, committedOf, splitBudget } from "../src";

const base = {
  accountCapCents: 10_000,
  briefCapCents: 5_000,
  accountWeek: [],
  briefWeek: [],
  requestedCents: 1_000,
  killSwitchEngaged: false,
};

describe("budget governor", () => {
  it("allows a request within both caps", () => {
    expect(checkBudget(base).allowed).toBe(true);
  });

  it("refuses over the brief cap", () => {
    const r = checkBudget({
      ...base,
      briefWeek: [{ committedCents: 4_500, actualCents: 0 }],
      requestedCents: 600,
    });
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/brief weekly cap/);
  });

  it("refuses over the account cap even when the brief has room", () => {
    const r = checkBudget({
      ...base,
      briefCapCents: 50_000,
      accountWeek: [{ committedCents: 9_900, actualCents: 0 }],
    });
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/account weekly cap/);
  });

  it("counts actual spend when it exceeds the commitment (manual edits)", () => {
    expect(committedOf([{ committedCents: 100, actualCents: 250 }])).toBe(250);
  });

  it("refuses everything while the kill switch is engaged", () => {
    expect(checkBudget({ ...base, killSwitchEngaged: true }).allowed).toBe(false);
  });

  it("refuses non-positive or fractional requests", () => {
    expect(checkBudget({ ...base, requestedCents: 0 }).allowed).toBe(false);
    expect(checkBudget({ ...base, requestedCents: 10.5 }).allowed).toBe(false);
  });

  it("invariant: approved commitments never push committed spend over either cap", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100_000 }),
        fc.integer({ min: 0, max: 100_000 }),
        fc.array(fc.integer({ min: 1, max: 20_000 }), { maxLength: 30 }),
        (accountCap, briefCap, requests) => {
          const ledger: { committedCents: number; actualCents: number }[] = [];
          for (const requestedCents of requests) {
            const r = checkBudget({
              ...base,
              accountCapCents: accountCap,
              briefCapCents: briefCap,
              accountWeek: ledger,
              briefWeek: ledger,
              requestedCents,
            });
            if (r.allowed) ledger.push({ committedCents: requestedCents, actualCents: 0 });
          }
          const committed = committedOf(ledger);
          return committed <= accountCap && committed <= briefCap;
        },
      ),
    );
  });

  it("invariant: splitBudget sums exactly to the total and never goes negative", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1_000_000 }), fc.integer({ min: 1, max: 50 }), (total, parts) => {
        const split = splitBudget(total, parts);
        return (
          split.length === parts && split.reduce((a, b) => a + b, 0) === total && split.every((x) => x >= 0)
        );
      }),
    );
    expect(splitBudget(100, 0)).toEqual([]);
  });
});
