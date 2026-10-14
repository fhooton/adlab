import type { ReactNode } from "react";
import type { Tone } from "./Badge";
import { cx } from "./cx";

const toneClass: Record<Tone, string> = {
  running: "border-running/30 bg-running-bg text-running",
  pending: "border-pending/30 bg-pending-bg text-pending",
  killed: "border-line bg-killed-bg text-ink-2",
  won: "border-won/30 bg-won-bg text-won",
  failed: "border-failed/30 bg-failed-bg text-failed",
  nmd: "border-nmd/30 bg-nmd-bg text-nmd",
  neutral: "border-line bg-surface-2 text-ink-2",
};

export interface NoticeProps {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
  role?: "status" | "alert";
}

/** Inline banner / toast body. Tinted by status tone. */
export function Notice({
  tone = "neutral",
  title,
  children,
  action,
  className,
  role = "status",
}: NoticeProps) {
  return (
    <div
      role={role}
      className={cx("flex items-start gap-3 rounded-sm border px-3 py-2 text-sm", toneClass[tone], className)}
    >
      <div className="min-w-0 flex-1">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cx(title ? "mt-0.5" : undefined, "text-ink-2")}>{children}</div>}
      </div>
      {action}
    </div>
  );
}
