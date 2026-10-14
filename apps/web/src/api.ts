import { buildRequest, type CommandInput, commands, type ErrorBody } from "@adlab/contracts";
import type { DashboardCommand, Outputs, Whoami } from "./types";

/**
 * Tiny typed client over the shared command registry (same contract as packages/client).
 * Same-origin requests; the session is an httpOnly cookie. Every non-GET carries the CSRF header.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
  get isConflict() {
    return this.status === 409;
  }
}

type Listener = () => void;
const unauthorized = new Set<Listener>();
/** Subscribe to 401s (the auth provider sends the user to /login). */
export function onUnauthorized(fn: Listener) {
  unauthorized.add(fn);
  return () => {
    unauthorized.delete(fn);
  };
}

async function request(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<{ status: number; body: unknown }> {
  const headers: Record<string, string> = { accept: "application/json" };
  if (method !== "GET") headers["x-adlab-csrf"] = "1";
  if (body !== undefined) headers["content-type"] = "application/json";
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers,
      credentials: "same-origin",
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (err) {
    throw new ApiError(0, "unreachable", `Cannot reach the adlab API (${(err as Error).message})`);
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = (json as Partial<ErrorBody>).error;
    if (res.status === 401 && !path.startsWith("/v1/auth/")) for (const fn of unauthorized) fn();
    throw new ApiError(res.status, e?.code ?? "error", e?.message ?? `HTTP ${res.status}`, e?.details);
  }
  return { status: res.status, body: json };
}

/** Call a registry command. Returns the HTTP status too (202 = pending approval). */
export async function call<K extends DashboardCommand>(
  key: K,
  input?: CommandInput<K>,
): Promise<{ status: number; body: Outputs[K] }> {
  const req = buildRequest(commands[key], (input ?? {}) as Record<string, unknown>);
  let path = req.path;
  if (req.query) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(req.query))
      if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
    const s = qs.toString();
    if (s) path += `?${s}`;
  }
  const res = await request(req.method, path, req.body);
  return { status: res.status, body: res.body as Outputs[K] };
}

/** Call a command and return only the body. */
export async function run<K extends DashboardCommand>(key: K, input?: CommandInput<K>): Promise<Outputs[K]> {
  return (await call(key, input)).body;
}

export async function login(name: string, password: string): Promise<Whoami> {
  return (await request("POST", "/v1/auth/login", { name, password })).body as Whoami;
}

export async function logout(): Promise<void> {
  await request("POST", "/v1/auth/logout");
}

/** URL of the live HyperFrames composition for a variant (template + injected variables). */
export function previewUrl(variantId: string, aspect: string) {
  return `/v1/variants/${encodeURIComponent(variantId)}/preview?aspect=${encodeURIComponent(aspect)}`;
}
