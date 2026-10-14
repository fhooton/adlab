export type ActorKind = "human" | "agent" | "system";

export interface Actor {
  kind: ActorKind;
  /** Display name for humans, secret name for agents, job name for system. */
  name: string;
}

export const actorLabel = (a: Actor) => `${a.kind}:${a.name}`;

/** The line that keeps an agent from approving its own spend. */
export function canDecideApprovals(actor: Actor): boolean {
  return actor.kind === "human";
}

/** Parse "name:secret,name:secret" into a map of secret → name. Rejects weak or duplicate secrets. */
export function parseNamedSecrets(raw: string | undefined): Map<string, string> {
  const out = new Map<string, string>();
  for (const entry of (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)) {
    const idx = entry.indexOf(":");
    if (idx <= 0)
      throw new Error(`Malformed ADLAB_API_TOKENS entry (want name:secret): ${entry.slice(0, 12)}…`);
    const name = entry.slice(0, idx);
    const secret = entry.slice(idx + 1);
    if (!/^[a-z0-9][a-z0-9_-]{0,40}$/i.test(name)) throw new Error(`Invalid token name: ${name}`);
    if (secret.length < 24) throw new Error(`Token "${name}" is too short (min 24 chars)`);
    if (out.has(secret)) throw new Error(`Duplicate secret for "${name}"`);
    out.set(secret, name);
  }
  return out;
}
