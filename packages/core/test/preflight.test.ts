import type { AuditEntry } from "@adlab/contracts";
import { describe, expect, it } from "vitest";
import {
  buildDigest,
  canDecideApprovals,
  checkDuplicates,
  checkNaming,
  checkPolicy,
  checkSpecs,
  idempotencyKey,
  parseNamedSecrets,
  parsePolicyPack,
  preflightOk,
  stableStringify,
  weekStart,
} from "../src";

const pack = parsePolicyPack(
  "meta-core",
  "meta",
  [
    "# Meta",
    "- `personal-attributes` [error] /\\bare you (overweight|depressed|broke)\\b/i — Do not assert or imply personal attributes",
    "- `guarantee` [warning] /guaranteed/i — Avoid unqualified guarantees",
    "not a rule",
  ].join("\n"),
);

const v = (id: string, over: Partial<Parameters<typeof checkPolicy>[0][number]> = {}) => ({
  id,
  label: id,
  specHash: id,
  texts: ["Hello"],
  headline: "Short",
  primaryText: "Short",
  aspectRatios: ["9:16"],
  renderedAspects: ["9:16"],
  ...over,
});

describe("preflight", () => {
  it("parses policy packs from markdown", () => {
    expect(pack.rules.map((r) => r.id)).toEqual(["personal-attributes", "guarantee"]);
  });

  it("flags policy matches with severity", () => {
    const res = checkPolicy(
      [
        v("var_a", { texts: ["Are you overweight?"] }),
        v("var_b", { texts: ["Guaranteed results"] }),
        v("var_c"),
      ],
      [pack],
    );
    expect(res.find((r) => r.variantId === "var_a")?.severity).toBe("error");
    expect(res.find((r) => r.variantId === "var_b")?.severity).toBe("warning");
    expect(res.find((r) => r.variantId === "var_c")?.ok).toBe(true);
    expect(preflightOk(res)).toBe(false);
  });

  it("checks specs: warnings for length, errors for missing renders", () => {
    const res = checkSpecs(
      [
        v("var_a", {
          headline: "h".repeat(41),
          primaryText: "p".repeat(126),
          aspectRatios: ["9:16", "1:1", "4:5"],
          renderedAspects: ["9:16"],
        }),
      ],
      { var_a: ["9:16", "1:1"] },
    );
    expect(res.map((r) => r.check).sort()).toEqual([
      "spec:aspect",
      "spec:headline",
      "spec:primary-text",
      "spec:render",
    ]);
    expect(checkSpecs([v("var_a")], { var_a: ["9:16"] })[0]?.ok).toBe(true);
  });

  it("detects duplicate specs", () => {
    expect(checkDuplicates([v("var_a", { specHash: "x" }), v("var_b", { specHash: "x" })])[0]?.ok).toBe(
      false,
    );
    expect(checkDuplicates([v("var_a")])[0]?.ok).toBe(true);
  });

  it("checks naming round-trips", () => {
    expect(checkNaming("tst_abc123", [{ id: "var_abc123", label: "x|y" }])[0]?.ok).toBe(true);
    expect(checkNaming("bad", [{ id: "var_abc123", label: "" }])[0]?.ok).toBe(false);
  });
});

describe("actors and secrets", () => {
  it("only humans decide approvals", () => {
    expect(canDecideApprovals({ kind: "human", name: "sam" })).toBe(true);
    expect(canDecideApprovals({ kind: "agent", name: "claude" })).toBe(false);
    expect(canDecideApprovals({ kind: "system", name: "rules" })).toBe(false);
  });

  it("parses named secrets and rejects weak ones", () => {
    const s = "a".repeat(24);
    expect(parseNamedSecrets(`claude-laptop:${s}`).get(s)).toBe("claude-laptop");
    expect(parseNamedSecrets(undefined).size).toBe(0);
    expect(() => parseNamedSecrets("claude:short")).toThrow(/too short/);
    expect(() => parseNamedSecrets(`nocolon${s}`)).toThrow(/Malformed/);
    expect(() => parseNamedSecrets(`a:${s},b:${s}`)).toThrow(/Duplicate/);
    expect(() => parseNamedSecrets(`bad name:${s}`)).toThrow(/Invalid token name/);
  });
});

describe("misc", () => {
  it("stable stringify sorts keys", () => {
    expect(stableStringify({ b: 1, a: [1, { d: 1, c: undefined }] })).toBe('{"a":[1,{"d":1}],"b":1}');
  });

  it("idempotency keys are stable", () => {
    expect(idempotencyKey("t", 1, null)).toBe(idempotencyKey("t", 1, undefined));
    expect(idempotencyKey("t", 1)).not.toBe(idempotencyKey("t", 2));
  });

  it("week starts on Monday UTC", () => {
    expect(weekStart(new Date("2026-10-14T12:00:00Z"))).toBe("2026-10-12");
    expect(weekStart(new Date("2026-10-18T23:59:00Z"))).toBe("2026-10-12");
  });

  it("builds a digest", () => {
    const entry = (action: string, detail: Record<string, unknown>): AuditEntry => ({
      id: "aud_1",
      actor: "x",
      actorKind: "system",
      action,
      targetType: "t",
      targetId: "id",
      detail,
      createdAt: new Date().toISOString(),
    });
    const d = buildDigest({
      since: new Date("2026-10-13T00:00:00Z"),
      until: new Date("2026-10-14T00:00:00Z"),
      spendCents: 1234,
      activity: [
        entry("test.launched", { summary: "Stage 1" }),
        entry("decision.applied.kill", {}),
        entry("alert.drift", { message: "Budget edited in Ads Manager" }),
      ],
      pendingApprovals: [{ id: "apr_1", title: "Launch", amountCents: 5000 }],
    });
    expect(d.launched).toEqual(["Stage 1"]);
    expect(d.killed).toEqual(["id"]);
    expect(d.text).toContain("$12.34");
    expect(d.text).toContain("Budget edited");
  });
});
