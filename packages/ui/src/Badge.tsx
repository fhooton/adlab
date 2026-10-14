import type { ReactNode } from "react";
import { cx } from "./cx";

/** The status palette, defined once in tokens.css. */
export type Tone = "running" | "pending" | "killed" | "won" | "failed" | "nmd" | "neutral";

const toneClass: Record<Tone, string> = {
  running: "bg-running-bg text-running",
  pending: "bg-pending-bg text-pending",
  killed: "bg-killed-bg text-killed",
  won: "bg-won-bg text-won",
  failed: "bg-failed-bg text-failed",
  nmd: "bg-nmd-bg text-nmd",
  neutral: "bg-neutral-bg text-neutral",
};

const dotClass: Record<Tone, string> = {
  running: "bg-running",
  pending: "bg-pending",
  killed: "bg-killed",
  won: "bg-won",
  failed: "bg-failed",
  nmd: "bg-nmd",
  neutral: "bg-neutral",
};

/**
 * Maps any status string used across adlab to a tone. Unknown strings are neutral.
 * Tests, variants, approvals, decisions, hypotheses and learnings all share this table.
 */
const STATUS_TONE: Record<string, Tone> = {
  running: "running",
  live: "running",
  launching: "running",
  rendering: "running",
  active: "running",
  syncing: "running",
  pending: "pending",
  pending_approval: "pending",
  proposed: "pending",
  draft: "neutral",
  ready: "neutral",
  rendered: "neutral",
  tested: "neutral",
  ended: "neutral",
  archived: "neutral",
  hold: "neutral",
  paused: "killed",
  killed: "killed",
  kill: "killed",
  declined: "killed",
  rejected: "killed",
  superseded: "killed",
  retired: "killed",
  lost: "killed",
  won: "won",
  approved: "won",
  applied: "won",
  selected: "won",
  promote: "won",
  scale: "won",
  failed: "failed",
  render_failed: "failed",
  preflight_failed: "failed",
  expired: "failed",
  flagged: "failed",
  need_more_data: "nmd",
  "need-more-data": "nmd",
  stale: "pending",
};

export function toneFor(status: string): Tone {
  return STATUS_TONE[status] ?? "neutral";
}

/** "pending_approval" -> "Pending approval" */
export function humanize(s: string): string {
  const t = s.replace(/[_-]+/g, " ").trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export interface BadgeProps {
  tone?: Tone;
  children: ReactNode;
  /** Leading status dot. */
  dot?: boolean;
  /** Outline instead of tint, for low-emphasis labels like tags. */
  outline?: boolean;
  className?: string;
  title?: string;
}

export function Badge({ tone = "neutral", children, dot, outline, className, title }: BadgeProps) {
  return (
    <span
      title={title}
      className={cx(
        "inline-flex h-[18px] max-w-full shrink-0 items-center gap-1 whitespace-nowrap rounded-xs px-1.5 text-xs font-medium leading-none",
        outline ? "border border-line bg-transparent text-ink-2" : toneClass[tone],
        className,
      )}
    >
      {dot && <span className={cx("size-1.5 shrink-0 rounded-full", dotClass[tone])} aria-hidden="true" />}
      <span className="truncate">{children}</span>
    </span>
  );
}

export interface StatusBadgeProps {
  /** Any adlab status string; mapped to a tone with `toneFor`. */
  status: string;
  /** Override the displayed text (defaults to the humanized status). */
  label?: ReactNode;
  className?: string;
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  return (
    <Badge tone={toneFor(status)} dot className={className}>
      {label ?? humanize(status)}
    </Badge>
  );
}

/** Just the dot, for very dense rows. */
export function StatusDot({ status, className }: { status: string; className?: string }) {
  return (
    <span
      title={humanize(status)}
      className={cx("inline-block size-2 shrink-0 rounded-full", dotClass[toneFor(status)], className)}
    />
  );
}
