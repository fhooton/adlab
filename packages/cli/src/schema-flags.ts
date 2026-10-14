import type { z } from "zod";

export type FlagType = "string" | "number" | "boolean" | "string[]";

/** Unwrap optional/default/nullable wrappers to the base Zod type. */
function base(t: z.ZodType): { type: string; inner: z.ZodType; optional: boolean } {
  let cur: any = t;
  let optional = false;
  for (let i = 0; i < 10; i++) {
    const kind = cur?.def?.type;
    if (kind === "optional" || kind === "default" || kind === "nullable" || kind === "prefault") {
      optional = true;
      cur = cur.def.innerType;
    } else break;
  }
  return { type: cur?.def?.type ?? "unknown", inner: cur, optional };
}

export interface FlagSpec {
  key: string;
  flag: string;
  type: FlagType;
  required: boolean;
  description?: string;
}

const kebab = (s: string) => s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

/** Top-level primitive fields become `--kebab-case` flags; everything else goes through --input. */
export function flagsFor(schema: z.ZodObject): FlagSpec[] {
  const out: FlagSpec[] = [];
  for (const [key, field] of Object.entries(schema.shape) as Array<[string, z.ZodType]>) {
    const b = base(field);
    let type: FlagType | null = null;
    if (b.type === "string" || b.type === "enum" || b.type === "literal") type = "string";
    else if (b.type === "number" || b.type === "int") type = "number";
    else if (b.type === "boolean") type = "boolean";
    else if (b.type === "union") type = "number";
    else if (b.type === "array" && base((b.inner as any).def.element).type === "string") type = "string[]";
    if (!type) continue;
    out.push({
      key,
      flag: kebab(key),
      type,
      required: !b.optional,
      description: (field as any).description ?? (b.inner as any).description,
    });
  }
  return out;
}

export function coerceFlag(type: FlagType, raw: string | boolean): unknown {
  if (type === "boolean") return raw === true || raw === "true";
  if (type === "number") return Number(raw);
  if (type === "string[]")
    return String(raw)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  return raw;
}
