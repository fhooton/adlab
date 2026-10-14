/** Deterministic JSON: object keys sorted, so equal specs hash equal regardless of key order. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}

/** 64-bit FNV-1a as 16 hex chars. Not cryptographic; used for spec hashes and idempotency keys. */
export function fnv1a64(input: string): string {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (let i = 0; i < input.length; i++) {
    hash ^= BigInt(input.charCodeAt(i));
    hash = (hash * prime) & 0xffffffffffffffffn;
  }
  return hash.toString(16).padStart(16, "0");
}

export function hashOf(value: unknown): string {
  return fnv1a64(stableStringify(value));
}

/** Idempotency key for a platform write: same logical write, same key, across retries. */
export function idempotencyKey(...parts: Array<string | number | null | undefined>): string {
  return `idem_${fnv1a64(parts.map((p) => String(p ?? "")).join("|"))}`;
}
