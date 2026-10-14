import { randomBytes } from "node:crypto";

const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

/** Prefixed, lowercase, URL- and name-safe ids, e.g. var_k3m9x2p4qa7d. Compatible with naming.ts. */
export function newId(
  prefix:
    | "brf"
    | "res"
    | "hyp"
    | "tpl"
    | "var"
    | "ast"
    | "tst"
    | "plo"
    | "met"
    | "dec"
    | "apr"
    | "led"
    | "lrn"
    | "rat"
    | "gen"
    | "aud"
    | "job",
): string {
  const bytes = randomBytes(12);
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return `${prefix}_${out}`;
}
