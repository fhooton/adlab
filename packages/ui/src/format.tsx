import type { ReactNode } from "react";
import { cx } from "./cx";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const usdWhole = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const usdCompact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});
const int = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

export const DASH = "—";

/** Format integer cents as USD. `whole` drops cents; `compact` gives "$1.2K". */
export function formatMoney(
  cents: number | null | undefined,
  opts: { whole?: boolean; compact?: boolean } = {},
): string {
  if (cents === null || cents === undefined || Number.isNaN(cents)) return DASH;
  const dollars = cents / 100;
  if (opts.compact && Math.abs(dollars) >= 10_000) return usdCompact.format(dollars);
  return (opts.whole ? usdWhole : usd).format(dollars);
}

/** Format a 0–1 fraction as a percentage. */
export function formatPercent(fraction: number | null | undefined, digits = 1): string {
  if (fraction === null || fraction === undefined || Number.isNaN(fraction)) return DASH;
  return `${(fraction * 100).toFixed(digits)}%`;
}

export function formatNumber(n: number | null | undefined, opts: { compact?: boolean } = {}): string {
  if (n === null || n === undefined || Number.isNaN(n)) return DASH;
  return opts.compact && Math.abs(n) >= 10_000 ? compact.format(n) : int.format(n);
}

/** "3m ago", "2h ago", "Oct 12". Pass `now` for deterministic output. */
export function formatRelative(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return DASH;
  const t = new Date(iso).getTime();
  const s = Math.round((now.getTime() - t) / 1000);
  const abs = Math.abs(s);
  // Future timestamps (e.g. a simulated platform clock) read better as absolute times.
  if (s < -60) return formatDateTime(iso);
  if (abs < 45) return "just now";
  if (abs < 3600) return `${Math.round(abs / 60)}m ago`;
  if (abs < 86_400) return `${Math.round(abs / 3600)}h ago`;
  if (abs < 7 * 86_400) return `${Math.round(abs / 86_400)}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** "Oct 14, 13:51". */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return DASH;
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

interface NumProps {
  className?: string;
  /** Render muted (e.g. secondary figures, null values). */
  muted?: boolean;
}

/** Monospace tabular wrapper for any figure. */
export function Num({ children, className, muted }: NumProps & { children: ReactNode }) {
  return <span className={cx("num", muted && "text-ink-3", className)}>{children}</span>;
}

/** Money in integer cents. */
export function Money({
  cents,
  whole,
  compact,
  className,
}: NumProps & { cents: number | null | undefined; whole?: boolean; compact?: boolean }) {
  const empty = cents === null || cents === undefined;
  return (
    <Num className={className} muted={empty}>
      {formatMoney(cents, { whole, compact })}
    </Num>
  );
}

/** A 0–1 fraction as a percent. */
export function Percent({
  value,
  digits = 1,
  className,
}: NumProps & { value: number | null | undefined; digits?: number }) {
  const empty = value === null || value === undefined;
  return (
    <Num className={className} muted={empty}>
      {formatPercent(value, digits)}
    </Num>
  );
}

/** Integer count with thousands separators. */
export function Count({
  value,
  compact,
  className,
}: NumProps & { value: number | null | undefined; compact?: boolean }) {
  const empty = value === null || value === undefined;
  return (
    <Num className={className} muted={empty}>
      {formatNumber(value, { compact })}
    </Num>
  );
}

export interface StatProps {
  label: ReactNode;
  children: ReactNode;
  className?: string;
  /** Stack label above value (default) or inline. */
  inline?: boolean;
}

/** A small label/value pair, used in page headers and side panels. */
export function Stat({ label, children, className, inline }: StatProps) {
  if (inline) {
    return (
      <span className={cx("inline-flex items-baseline gap-1.5", className)}>
        <span className="text-xs text-ink-3">{label}</span>
        <span className="text-base text-ink">{children}</span>
      </span>
    );
  }
  return (
    <div className={cx("flex min-w-0 flex-col gap-0.5", className)}>
      <span className="text-xs text-ink-3">{label}</span>
      <span className="truncate text-base text-ink">{children}</span>
    </div>
  );
}
