import type { ReactNode } from "react";
import { cx } from "./cx";

export interface MeterProps {
  /** Solid segment (e.g. actual spend). */
  value: number;
  /** Optional hatched segment drawn behind `value` (e.g. committed spend). */
  committed?: number;
  /** The cap; the bar's full width. */
  max: number;
  label?: ReactNode;
  /** Right-aligned text above the bar, e.g. "$120 of $500". */
  valueLabel?: ReactNode;
  /** Fraction of max at which the bar turns pending (default 0.8) — and failed above 1. */
  warnAt?: number;
  className?: string;
  size?: "sm" | "md";
}

/** Progress against a cap with an optional "committed" segment. Turns amber near the cap and red over it. */
export function Meter({
  value,
  committed,
  max,
  label,
  valueLabel,
  warnAt = 0.8,
  className,
  size = "md",
}: MeterProps) {
  const pct = (n: number) => `${Math.max(0, Math.min(100, max > 0 ? (n / max) * 100 : 0))}%`;
  const peak = Math.max(value, committed ?? 0);
  const ratio = max > 0 ? peak / max : 0;
  const fill = ratio > 1 ? "bg-failed" : ratio >= warnAt ? "bg-pending" : "bg-ink-2";
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      {(label || valueLabel) && (
        <div className="flex items-baseline justify-between gap-3 text-xs">
          <span className="text-ink-3">{label}</span>
          <span className="num text-ink-2">{valueLabel}</span>
        </div>
      )}
      <div
        className={cx(
          "relative w-full overflow-hidden rounded-xs bg-surface-3",
          size === "sm" ? "h-1.5" : "h-2",
        )}
        aria-hidden="true"
      >
        {committed !== undefined && committed > value && (
          <div
            className="absolute inset-y-0 left-0 opacity-35"
            style={{
              width: pct(committed),
              backgroundImage:
                "repeating-linear-gradient(135deg, var(--color-ink-3) 0 2px, transparent 2px 5px)",
            }}
          />
        )}
        <div className={cx("absolute inset-y-0 left-0", fill)} style={{ width: pct(value) }} />
      </div>
    </div>
  );
}
