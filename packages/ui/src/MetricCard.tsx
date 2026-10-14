import type { ReactNode } from "react";
import { cx } from "./cx";
import { Sparkline } from "./Sparkline";

export interface MetricCardProps {
  label: ReactNode;
  /** The figure. Pass formatted text or a <Money>/<Percent> element. */
  value: ReactNode;
  /** Change vs the comparison period, e.g. "+12%". */
  delta?: ReactNode;
  /** Whether the delta is good, bad or neutral. Colours only the delta text. */
  deltaTone?: "up" | "down" | "flat";
  /** Secondary line under the value. */
  hint?: ReactNode;
  /** Optional series drawn as a sparkline. */
  sparkline?: number[];
  /** Emphasise with a status tone (e.g. pending approvals > 0). */
  tone?: "pending" | "failed" | "won";
  className?: string;
  onClick?: () => void;
}

const toneBorder = {
  pending: "before:bg-pending",
  failed: "before:bg-failed",
  won: "before:bg-won",
} as const;
const deltaClass = { up: "text-won", down: "text-failed", flat: "text-ink-3" } as const;

/** Compact KPI tile: label, big tabular number, optional delta and sparkline. */
export function MetricCard({
  label,
  value,
  delta,
  deltaTone = "flat",
  hint,
  sparkline,
  tone,
  className,
  onClick,
}: MetricCardProps) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cx(
        "relative flex min-w-0 flex-col gap-1 overflow-hidden bg-surface px-3.5 py-3 text-left",
        tone && cx("before:absolute before:inset-y-0 before:left-0 before:w-0.5", toneBorder[tone]),
        onClick && "transition-colors hover:bg-surface-2",
        className,
      )}
    >
      <span className="truncate text-xs text-ink-3">{label}</span>
      <span className="flex items-end justify-between gap-2">
        <span className="num truncate text-xl font-medium text-ink">{value}</span>
        {sparkline && sparkline.length > 0 && <Sparkline values={sparkline} width={64} height={20} />}
      </span>
      {(delta || hint) && (
        <span className="flex items-center gap-1.5 text-xs">
          {delta && <span className={cx("num", deltaClass[deltaTone])}>{delta}</span>}
          {hint && <span className="truncate text-ink-3">{hint}</span>}
        </span>
      )}
    </Comp>
  );
}

/** Lays MetricCards out in a hairline-divided strip (one border, no gaps). */
export function MetricGrid({
  children,
  className,
  columns = 4,
}: {
  children: ReactNode;
  className?: string;
  columns?: 2 | 3 | 4 | 5 | 6 | 7;
}) {
  const cols = {
    2: "lg:grid-cols-2",
    3: "lg:grid-cols-3",
    4: "lg:grid-cols-4",
    5: "lg:grid-cols-5",
    6: "lg:grid-cols-6",
    7: "lg:grid-cols-7",
  }[columns];
  return (
    <div
      className={cx(
        "grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-3",
        cols,
        className,
      )}
    >
      {children}
    </div>
  );
}
