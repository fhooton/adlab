/**
 * Every campaign, ad set and ad name carries its registry IDs, so results map back to
 * hypotheses even if the DB sync breaks or someone exports from Ads Manager.
 *
 *   ADL|<testId>|<variantId or ->|<kind>|<label>
 */
export type ObjectKind = "campaign" | "adset" | "ad";

export interface NameParts {
  testId: string;
  variantId: string | null;
  kind: ObjectKind;
  label: string;
}

const PREFIX = "ADL";
const ID_RE = /^[a-z]{2,5}_[a-z0-9]{6,32}$/;
const KINDS: readonly ObjectKind[] = ["campaign", "adset", "ad"];

export function sanitizeLabel(label: string): string {
  return label
    .replace(/[|\n\r\t]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

export function encodeName(parts: NameParts): string {
  if (!ID_RE.test(parts.testId)) throw new Error(`Invalid test id for naming: ${parts.testId}`);
  if (parts.variantId !== null && !ID_RE.test(parts.variantId)) {
    throw new Error(`Invalid variant id for naming: ${parts.variantId}`);
  }
  if (parts.kind !== "campaign" && parts.variantId === null)
    throw new Error(`${parts.kind} names need a variant id`);
  return [PREFIX, parts.testId, parts.variantId ?? "-", parts.kind, sanitizeLabel(parts.label)].join("|");
}

export function parseName(name: string): NameParts | null {
  const segments = name.split("|");
  if (segments.length < 5 || segments[0] !== PREFIX) return null;
  const [, testId, variantId, kind, ...labelParts] = segments as [
    string,
    string,
    string,
    string,
    ...string[],
  ];
  if (!ID_RE.test(testId)) return null;
  if (variantId !== "-" && !ID_RE.test(variantId)) return null;
  if (!KINDS.includes(kind as ObjectKind)) return null;
  return {
    testId,
    variantId: variantId === "-" ? null : variantId,
    kind: kind as ObjectKind,
    label: labelParts.join("|"),
  };
}

export interface UtmParts {
  platform: string;
  testId: string;
  variantId: string;
  hypothesisId: string;
}

/** Destination URL with UTMs that carry registry IDs. Existing query params are preserved. */
export function trackedUrl(base: string, utm: UtmParts): string {
  const url = new URL(base);
  url.searchParams.set("utm_source", utm.platform);
  url.searchParams.set("utm_medium", "paid_social");
  url.searchParams.set("utm_campaign", utm.testId);
  url.searchParams.set("utm_content", utm.variantId);
  url.searchParams.set("utm_term", utm.hypothesisId);
  return url.toString();
}
