import type { Hypothesis, Tags, Template, VariableValues, VariantSpec } from "@adlab/contracts";
import { hashOf } from "./hash";

export interface SpecError {
  index: number;
  label: string;
  message: string;
}

/** Validate filled variables against a template's declared variable schema. */
export function validateVariables(template: Template, values: VariableValues): string[] {
  const errors: string[] = [];
  const declared = new Map(template.variables.map((v) => [v.id, v]));
  for (const key of Object.keys(values)) {
    if (!declared.has(key)) errors.push(`Unknown variable "${key}" for template ${template.id}`);
  }
  for (const v of template.variables) {
    const value = values[v.id];
    if (value === undefined) {
      if (v.default === undefined) errors.push(`Missing required variable "${v.id}"`);
      continue;
    }
    const expected = v.type === "number" ? "number" : v.type === "boolean" ? "boolean" : "string";
    if (typeof value !== expected) {
      errors.push(`Variable "${v.id}" should be ${expected}, got ${typeof value}`);
      continue;
    }
    if (typeof value === "string" && v.maxLength && value.length > v.maxLength) {
      errors.push(`Variable "${v.id}" is ${value.length} chars; max ${v.maxLength}`);
    }
    if (v.type === "color" && typeof value === "string" && !/^#[0-9a-fA-F]{6}$/.test(value)) {
      errors.push(`Variable "${v.id}" should be a #rrggbb colour`);
    }
    if (
      v.type === "url" &&
      typeof value === "string" &&
      value !== "" &&
      !/^(https?:\/\/|assets\/)/.test(value)
    ) {
      errors.push(`Variable "${v.id}" should be an http(s) URL or an assets/ path`);
    }
  }
  return errors;
}

/** The dimensions a variant can change. Copy fields count as variables too. */
export function testableDimensions(spec: Pick<VariantSpec, "variables" | "copy">): Record<string, unknown> {
  const dims: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(spec.variables)) dims[`var.${k}`] = v;
  for (const [k, v] of Object.entries(spec.copy)) dims[`copy.${k}`] = v;
  return dims;
}

export function changedDimensions(control: VariantSpec, variant: VariantSpec): string[] {
  const a = testableDimensions(control);
  const b = testableDimensions(variant);
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].filter((k) => a[k] !== b[k]).sort();
}

/**
 * One variable changed per variant: with more than one variant, exactly one must be the control
 * and every other variant must differ from it in exactly one dimension. That keeps attribution exact.
 */
export function checkOneVariableRule(specs: VariantSpec[]): SpecError[] {
  if (specs.length <= 1) return [];
  const errors: SpecError[] = [];
  const controls = specs.map((s, i) => ({ s, i })).filter(({ s }) => s.isControl);
  if (controls.length !== 1) {
    return [
      { index: -1, label: "*", message: `Expected exactly one control variant, found ${controls.length}` },
    ];
  }
  const control = controls[0]!.s;
  specs.forEach((s, index) => {
    if (s.isControl) return;
    if (s.templateId !== control.templateId) {
      errors.push({
        index,
        label: s.label,
        message: "Variants in one set must share the control's template",
      });
      return;
    }
    const changed = changedDimensions(control, s);
    if (changed.length !== 1) {
      errors.push({
        index,
        label: s.label,
        message: `Must change exactly one variable vs control; changed ${changed.length}: ${changed.join(", ") || "none"}`,
      });
    }
  });
  return errors;
}

export function deriveTags(
  spec: VariantSpec,
  hypothesis: Pick<Hypothesis, "concept" | "persona" | "format">,
  ctx: { offer: string; market?: string; language?: string },
): Tags {
  return {
    concept: hypothesis.concept,
    persona: hypothesis.persona,
    format: hypothesis.format,
    hookType: spec.hookType,
    offer: ctx.offer,
    template: spec.templateId,
    footageSource: spec.footageSource,
    ...(ctx.market ? { market: ctx.market } : {}),
    ...(ctx.language ? { language: ctx.language } : {}),
  };
}

/** Same spec + template version → same hash → same render. Labels don't affect output. */
export function specHash(spec: VariantSpec, templateVersion: string): string {
  return hashOf({
    templateId: spec.templateId,
    templateVersion,
    variables: spec.variables,
    copy: spec.copy,
    aspectRatios: [...spec.aspectRatios].sort(),
  });
}
