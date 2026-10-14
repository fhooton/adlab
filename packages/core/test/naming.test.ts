import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { encodeName, parseName, sanitizeLabel, trackedUrl } from "../src";

const id = (prefix: string) => fc.stringMatching(/^[a-z0-9]{6,20}$/).map((s) => `${prefix}_${s}`);

describe("naming", () => {
  it("encodes and parses a campaign name", () => {
    const name = encodeName({ testId: "tst_abc123", variantId: null, kind: "campaign", label: "Stage 1" });
    expect(name).toBe("ADL|tst_abc123|-|campaign|Stage 1");
    expect(parseName(name)).toEqual({
      testId: "tst_abc123",
      variantId: null,
      kind: "campaign",
      label: "Stage 1",
    });
  });

  it("rejects foreign or malformed names", () => {
    expect(parseName("Summer Sale - Broad")).toBeNull();
    expect(parseName("ADL|bad|-|campaign|x")).toBeNull();
    expect(parseName("ADL|tst_abc123|-|creative|x")).toBeNull();
    expect(parseName("ADL|tst_abc123|nope|ad|x")).toBeNull();
  });

  it("refuses invalid ids and ad-level names without a variant", () => {
    expect(() => encodeName({ testId: "x", variantId: null, kind: "campaign", label: "" })).toThrow();
    expect(() => encodeName({ testId: "tst_abc123", variantId: "bad", kind: "ad", label: "" })).toThrow();
    expect(() => encodeName({ testId: "tst_abc123", variantId: null, kind: "ad", label: "" })).toThrow();
  });

  it("sanitizes separators out of labels", () => {
    expect(sanitizeLabel("a|b\nc   d")).toBe("a b c d");
  });

  it("invariant: names always parse back to their IDs", () => {
    fc.assert(
      fc.property(
        id("tst"),
        id("var"),
        fc.constantFrom("adset", "ad") as fc.Arbitrary<"adset" | "ad">,
        fc.string(),
        (testId, variantId, kind, label) => {
          const parsed = parseName(encodeName({ testId, variantId, kind, label }));
          return parsed?.testId === testId && parsed.variantId === variantId && parsed.kind === kind;
        },
      ),
    );
  });

  it("adds UTMs carrying registry ids and keeps existing params", () => {
    const url = new URL(
      trackedUrl("https://example.com/p?ref=1", {
        platform: "meta",
        testId: "tst_1",
        variantId: "var_1",
        hypothesisId: "hyp_1",
      }),
    );
    expect(url.searchParams.get("ref")).toBe("1");
    expect(url.searchParams.get("utm_content")).toBe("var_1");
    expect(url.searchParams.get("utm_campaign")).toBe("tst_1");
  });
});
