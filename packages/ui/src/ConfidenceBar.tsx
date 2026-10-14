import { cx } from "./cx";
import { formatPercent } from "./format";

export interface ConfidenceBarProps {
  /** Credible interval for this variant. null = no data yet. */
  interval: { low: number; mean: number; high: number } | null;
  /** Shared scale so bars in one table are comparable. */
  scale: { min: number; max: number };
  /** False renders the explicit "Need more data" state (the interval, if any, is drawn faintly). */
  enoughEvidence: boolean;
  /** Formats tick labels; defaults to percent with one decimal. */
  format?: (n: number) => string;
  /** Highlight tone for the interval: leader, control reference or default. */
  tone?: "default" | "won" | "killed" | "control";
  /** Optional reference line (e.g. the control's mean) on the same scale. */
  reference?: number | null;
  width?: number;
  className?: string;
}

const toneFill = { default: "bg-ink-2", won: "bg-won", killed: "bg-killed", control: "bg-running" } as const;

/** Interval low–high with a mean tick, on a scale shared across rows. */
export function ConfidenceBar({
  interval,
  scale,
  enoughEvidence,
  format = (n) => formatPercent(n, 1),
  tone = "default",
  reference,
  width = 160,
  className,
}: ConfidenceBarProps) {
  const span = scale.max - scale.min || 1;
  const pos = (v: number) => `${Math.max(0, Math.min(100, ((v - scale.min) / span) * 100))}%`;
  const title = interval
    ? `${format(interval.low)} – ${format(interval.high)} (mean ${format(interval.mean)})`
    : "No data yet";
  return (
    <div className={cx("flex items-center gap-2", className)} title={title}>
      <div className="relative h-4 shrink-0" style={{ width }}>
        <div
          className={cx(
            "absolute inset-x-0 top-1/2 h-px -translate-y-1/2",
            enoughEvidence ? "bg-line-strong" : "border-t border-dashed border-line-strong bg-transparent",
          )}
        />
        {reference !== null && reference !== undefined && (
          <div className="absolute inset-y-0 w-px bg-running opacity-50" style={{ left: pos(reference) }} />
        )}
        {interval && (
          <>
            <div
              className={cx(
                "absolute top-1/2 h-1.5 -translate-y-1/2 rounded-xs",
                toneFill[tone],
                enoughEvidence ? "opacity-35" : "opacity-15",
              )}
              style={{ left: pos(interval.low), width: `calc(${pos(interval.high)} - ${pos(interval.low)})` }}
            />
            <div
              className={cx(
                "absolute top-1/2 h-3 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-xs",
                toneFill[tone],
                !enoughEvidence && "opacity-40",
              )}
              style={{ left: pos(interval.mean) }}
            />
          </>
        )}
      </div>
      {enoughEvidence && interval ? (
        <span className="num whitespace-nowrap text-xs text-ink-2">{format(interval.mean)}</span>
      ) : (
        <span className="whitespace-nowrap text-xs font-medium text-nmd">Need more data</span>
      )}
    </div>
  );
}

/** Compute a shared scale for a set of intervals, padded a little and floored at 0. */
export function intervalScale(intervals: Array<{ low: number; high: number } | null>, pad = 0.1) {
  const xs = intervals.filter((i): i is { low: number; high: number } => i !== null);
  if (!xs.length) return { min: 0, max: 1 };
  const lo = Math.min(...xs.map((i) => i.low));
  const hi = Math.max(...xs.map((i) => i.high));
  const p = (hi - lo || hi || 1) * pad;
  return { min: Math.max(0, lo - p), max: hi + p };
}
