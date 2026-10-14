import type { ReactNode } from "react";
import { cx } from "./cx";

export interface EmptyStateProps {
  title: ReactNode;
  description?: ReactNode;
  /** A button or link to resolve the empty state. */
  action?: ReactNode;
  /** Compact variant for inside tables and panels. */
  compact?: boolean;
  className?: string;
}

/** Quiet empty state: no illustration, just what is missing and what to do about it. */
export function EmptyState({ title, description, action, compact, className }: EmptyStateProps) {
  return (
    <div
      className={cx(
        "flex flex-col items-center justify-center gap-1 text-center",
        compact ? "px-4 py-8" : "px-6 py-16",
        className,
      )}
    >
      <p className="text-base font-medium text-ink-2">{title}</p>
      {description && <p className="max-w-sm text-sm text-ink-3">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
