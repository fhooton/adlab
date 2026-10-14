import type { Template, VariantSpec } from "@adlab/contracts";
import { describe, expect, it } from "vitest";
import { changedDimensions, checkOneVariableRule, deriveTags, specHash, validateVariables } from "../src";

const template: Template = {
  id: "problem-solution-15s",
  name: "Problem / solution",
  version: "1.0.0",
  description: "",
  format: "motion_graphic",
  durationSeconds: 15,
  aspectRatios: ["9:16", "1:1"],
  variables: [
    { id: "hook", type: "string", label: "Hook", maxLength: 20 },
    { id: "accent", type: "color", label: "Accent", default: "#ff5a1f" },
    { id: "broll", type: "url", label: "B-roll", default: "" },
    { id: "speed", type: "number", label: "Speed", default: 1 },
  ],
};

const spec = (over: Partial<VariantSpec> = {}): VariantSpec => ({
  label: "ctrl",
  isControl: true,
  templateId: template.id,
  variables: { hook: "Tired of X?" },
  copy: { primaryText: "Fix X today.", headline: "Fix X", cta: "SHOP_NOW" },
  hookType: "question",
  footageSource: "none",
  aspectRatios: ["9:16"],
  ...over,
});

describe("variables", () => {
  it("accepts valid values and reports every problem", () => {
    expect(validateVariables(template, { hook: "Hi" })).toEqual([]);
    const errs = validateVariables(template, {
      hook: "x".repeat(30),
      accent: "red",
      broll: "ftp://x",
      speed: "fast",
      extra: 1,
    });
    expect(errs.join("\n")).toMatch(/Unknown variable "extra"/);
    expect(errs.join("\n")).toMatch(/max 20/);
    expect(errs.join("\n")).toMatch(/colour/);
    expect(errs.join("\n")).toMatch(/URL/);
    expect(errs.join("\n")).toMatch(/should be number/);
    expect(validateVariables(template, {})).toEqual(['Missing required variable "hook"']);
  });
});

describe("one-variable rule", () => {
  it("passes when each variant changes one dimension", () => {
    expect(
      checkOneVariableRule([spec(), spec({ isControl: false, label: "b", variables: { hook: "Still X?" } })]),
    ).toEqual([]);
  });

  it("flags variants that change two things or nothing", () => {
    const errs = checkOneVariableRule([
      spec(),
      spec({
        isControl: false,
        label: "two",
        variables: { hook: "Y?" },
        copy: { ...spec().copy, headline: "Other" },
      }),
      spec({ isControl: false, label: "none" }),
    ]);
    expect(errs.map((e) => e.label)).toEqual(["two", "none"]);
  });

  it("requires exactly one control and a shared template", () => {
    expect(checkOneVariableRule([spec(), spec()])[0]?.message).toMatch(/exactly one control/);
    expect(
      checkOneVariableRule([spec(), spec({ isControl: false, templateId: "other", label: "t" })])[0]?.message,
    ).toMatch(/template/);
    expect(checkOneVariableRule([spec()])).toEqual([]);
  });

  it("lists changed dimensions", () => {
    expect(changedDimensions(spec(), spec({ copy: { ...spec().copy, cta: "LEARN_MORE" } }))).toEqual([
      "copy.cta",
    ]);
  });
});

describe("tags and hashing", () => {
  it("derives tags from the spec, not inference", () => {
    const tags = deriveTags(
      spec(),
      { concept: "pain", persona: "busy-parent", format: "ugc" },
      { offer: "20% off", market: "US" },
    );
    expect(tags).toEqual({
      concept: "pain",
      persona: "busy-parent",
      format: "ugc",
      hookType: "question",
      offer: "20% off",
      template: template.id,
      footageSource: "none",
      market: "US",
    });
  });

  it("hash ignores label and key order, changes with content or template version", () => {
    const a = specHash(spec(), "1.0.0");
    expect(specHash(spec({ label: "other" }), "1.0.0")).toBe(a);
    expect(specHash(spec({ variables: { hook: "Different" } }), "1.0.0")).not.toBe(a);
    expect(specHash(spec(), "1.0.1")).not.toBe(a);
  });
});
