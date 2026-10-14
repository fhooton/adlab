import type { CheckResult } from "@adlab/contracts";
import { encodeName, parseName } from "./naming";

export interface PolicyRule {
  id: string;
  pattern: string;
  flags?: string;
  severity: "error" | "warning";
  message: string;
}

export interface PolicyPack {
  id: string;
  platform: string;
  rules: PolicyRule[];
}

export interface PreflightVariant {
  id: string;
  label: string;
  specHash: string;
  texts: string[];
  headline: string;
  primaryText: string;
  aspectRatios: string[];
  renderedAspects: string[];
}

/**
 * Parse a policy pack from markdown: any line of the form
 *   - `rule-id` [error|warning] /regex/flags — message
 * becomes a rule. Keeps policies human-editable in knowledge/policies/*.md.
 */
export function parsePolicyPack(id: string, platform: string, markdown: string): PolicyPack {
  const rules: PolicyRule[] = [];
  const re = /^\s*-\s*`([a-z0-9-]+)`\s*\[(error|warning)\]\s*\/(.+)\/([gimsuy]*)\s*[—-]+\s*(.+)$/;
  for (const line of markdown.split("\n")) {
    const m = re.exec(line);
    if (!m) continue;
    rules.push({
      id: m[1]!,
      severity: m[2] as "error" | "warning",
      pattern: m[3]!,
      flags: m[4] || "i",
      message: m[5]!.trim(),
    });
  }
  return { id, platform, rules };
}

export function checkPolicy(variants: PreflightVariant[], packs: PolicyPack[]): CheckResult[] {
  const results: CheckResult[] = [];
  for (const v of variants) {
    let hit = false;
    for (const pack of packs) {
      for (const rule of pack.rules) {
        const re = new RegExp(rule.pattern, rule.flags?.replace("g", "") ?? "i");
        const offending = v.texts.find((t) => re.test(t));
        if (offending !== undefined) {
          hit = true;
          results.push({
            check: `policy:${pack.id}:${rule.id}`,
            ok: false,
            severity: rule.severity,
            message: `${rule.message} (in "${offending.slice(0, 80)}")`,
            variantId: v.id,
          });
        }
      }
    }
    if (!hit)
      results.push({
        check: "policy",
        ok: true,
        severity: "error",
        message: "No policy matches",
        variantId: v.id,
      });
  }
  return results;
}

export const META_SPEC = { headlineRecommended: 40, primaryTextRecommended: 125 } as const;

export function checkSpecs(
  variants: PreflightVariant[],
  supportedAspects: Record<string, string[]>,
): CheckResult[] {
  const results: CheckResult[] = [];
  for (const v of variants) {
    if (v.headline.length > META_SPEC.headlineRecommended) {
      results.push({
        check: "spec:headline",
        ok: false,
        severity: "warning",
        message: `Headline ${v.headline.length} chars; truncates after ${META_SPEC.headlineRecommended}`,
        variantId: v.id,
      });
    }
    if (v.primaryText.length > META_SPEC.primaryTextRecommended) {
      results.push({
        check: "spec:primary-text",
        ok: false,
        severity: "warning",
        message: `Primary text ${v.primaryText.length} chars; truncates after ${META_SPEC.primaryTextRecommended}`,
        variantId: v.id,
      });
    }
    const supported = supportedAspects[v.id] ?? [];
    for (const aspect of v.aspectRatios) {
      if (!supported.includes(aspect)) {
        results.push({
          check: "spec:aspect",
          ok: false,
          severity: "error",
          message: `Template does not support ${aspect}`,
          variantId: v.id,
        });
      } else if (!v.renderedAspects.includes(aspect)) {
        results.push({
          check: "spec:render",
          ok: false,
          severity: "error",
          message: `No rendered asset for ${aspect}`,
          variantId: v.id,
        });
      }
    }
  }
  if (!results.some((r) => r.severity === "error")) {
    results.push({
      check: "spec",
      ok: true,
      severity: "error",
      message: "All variants have rendered assets for every placement",
    });
  }
  return results;
}

export function checkDuplicates(variants: PreflightVariant[]): CheckResult[] {
  const seen = new Map<string, string>();
  const results: CheckResult[] = [];
  for (const v of variants) {
    const prior = seen.get(v.specHash);
    if (prior) {
      results.push({
        check: "duplicates",
        ok: false,
        severity: "error",
        message: `Identical spec to variant ${prior}`,
        variantId: v.id,
      });
    } else seen.set(v.specHash, v.id);
  }
  if (results.length === 0)
    results.push({ check: "duplicates", ok: true, severity: "error", message: "No duplicate specs" });
  return results;
}

export function checkNaming(testId: string, variants: Array<{ id: string; label: string }>): CheckResult[] {
  const failures: CheckResult[] = [];
  const names = [
    { variantId: null, kind: "campaign" as const, label: "test" },
    ...variants.flatMap((v) => [
      { variantId: v.id, kind: "adset" as const, label: v.label },
      { variantId: v.id, kind: "ad" as const, label: v.label },
    ]),
  ];
  for (const n of names) {
    try {
      const parsed = parseName(encodeName({ testId, ...n }));
      if (!parsed || parsed.testId !== testId || parsed.variantId !== n.variantId || parsed.kind !== n.kind) {
        failures.push({
          check: "naming",
          ok: false,
          severity: "error",
          message: `Name does not round-trip for ${n.kind}`,
          variantId: n.variantId ?? undefined,
        });
      }
    } catch (err) {
      failures.push({
        check: "naming",
        ok: false,
        severity: "error",
        message: (err as Error).message,
        variantId: n.variantId ?? undefined,
      });
    }
  }
  return failures.length
    ? failures
    : [{ check: "naming", ok: true, severity: "error", message: "All names parse back to registry IDs" }];
}

export function preflightOk(results: CheckResult[]): boolean {
  return results.every((r) => r.ok || r.severity === "warning");
}
