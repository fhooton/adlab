import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { Actor } from "@adlab/core";
import type { Config } from "@adlab/services";
import type { Context } from "hono";
import { getCookie } from "hono/cookie";

export const SESSION_COOKIE = "adlab_session";
const SESSION_TTL_MS = 7 * 24 * 3_600_000;

const sha = (s: string) => createHash("sha256").update(s).digest();

/** Constant-time string compare (hash first so lengths never leak). */
export function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(sha(a), sha(b));
}

function sign(secret: string, payload: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function issueSession(cfg: Config, name: string): string {
  const payload = Buffer.from(JSON.stringify({ name, exp: Date.now() + SESSION_TTL_MS })).toString(
    "base64url",
  );
  return `${payload}.${sign(cfg.sessionSecret, payload)}`;
}

export function readSession(cfg: Config, token: string | undefined): { name: string } | null {
  if (!token || !cfg.sessionSecret) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig || !safeEqual(sig, sign(cfg.sessionSecret, payload))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as { name: string; exp: number };
    return data.exp > Date.now() && typeof data.name === "string" ? { name: data.name } : null;
  } catch {
    return null;
  }
}

/** Agents authenticate with a named bearer secret; humans with a signed session cookie. */
export function resolveActor(cfg: Config, c: Context): Actor | null {
  const header = c.req.header("authorization");
  if (header?.startsWith("Bearer ")) {
    const token = header.slice(7).trim();
    for (const [secret, name] of cfg.apiTokens) if (safeEqual(token, secret)) return { kind: "agent", name };
    return null;
  }
  const session = readSession(cfg, getCookie(c, SESSION_COOKIE));
  return session ? { kind: "human", name: session.name } : null;
}

/** Simple in-memory login rate limit: 10 attempts per 15 minutes per client. */
const attempts = new Map<string, { count: number; resetAt: number }>();
export function loginAllowed(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + 15 * 60_000 });
    return true;
  }
  entry.count++;
  return entry.count <= 10;
}
