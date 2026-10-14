import type { AuditEntry, Digest } from "@adlab/contracts";

export interface DigestInput {
  since: Date;
  until: Date;
  spendCents: number;
  activity: AuditEntry[];
  pendingApprovals: Array<{ id: string; title: string; amountCents: number | null }>;
}

const money = (c: number) => `$${(c / 100).toFixed(2)}`;

export function buildDigest(input: DigestInput): Digest {
  const pick = (action: string) =>
    input.activity
      .filter((a) => a.action === action)
      .map((a) => String(a.detail.summary ?? a.targetId ?? a.action));
  const launched = pick("test.launched");
  const killed = pick("decision.applied.kill");
  const promoted = [...pick("decision.applied.promote"), ...pick("decision.applied.scale")];
  const alerts = input.activity
    .filter((a) => a.action.startsWith("alert."))
    .map((a) => String(a.detail.message ?? a.action));
  const lines = [
    `adlab digest ${input.since.toISOString().slice(0, 16)}Z → ${input.until.toISOString().slice(0, 16)}Z`,
    `Spend: ${money(input.spendCents)}`,
    `Launched: ${launched.length}${launched.length ? ` (${launched.join("; ")})` : ""}`,
    `Killed: ${killed.length}${killed.length ? ` (${killed.join("; ")})` : ""}`,
    `Promoted/scaled: ${promoted.length}${promoted.length ? ` (${promoted.join("; ")})` : ""}`,
    `Awaiting approval: ${input.pendingApprovals.length}${input.pendingApprovals.map((p) => `\n  • ${p.title}${p.amountCents !== null ? ` — ${money(p.amountCents)}` : ""}`).join("")}`,
    ...(alerts.length ? [`Alerts:${alerts.map((a) => `\n  ! ${a}`).join("")}`] : []),
  ];
  return {
    since: input.since.toISOString(),
    until: input.until.toISOString(),
    spendCents: input.spendCents,
    launched,
    killed,
    promoted,
    pendingApprovals: input.pendingApprovals,
    alerts,
    text: lines.join("\n"),
  };
}
