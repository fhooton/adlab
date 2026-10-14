import { cx } from "./cx";

export interface RatingProps {
  /** Current value 1–5, or null when unrated. */
  value: number | null;
  /** Makes it interactive. */
  onChange?: (score: number) => void;
  disabled?: boolean;
  size?: "sm" | "md";
  className?: string;
  label?: string;
}

/** 1–5 rating as five segments. Read-only unless `onChange` is given. Fractional averages fill partially. */
export function Rating({ value, onChange, disabled, size = "sm", className, label = "Rating" }: RatingProps) {
  const seg = size === "md" ? "h-6 w-7 text-xs" : "h-1.5 w-3";
  if (!onChange) {
    return (
      <span
        className={cx("inline-flex items-center gap-0.5", className)}
        role="img"
        aria-label={value === null ? `${label}: unrated` : `${label}: ${value.toFixed(1)} of 5`}
      >
        {[1, 2, 3, 4, 5].map((n) => {
          const fill = value === null ? 0 : Math.max(0, Math.min(1, value - (n - 1)));
          return (
            <span key={n} className={cx("relative overflow-hidden rounded-[1px] bg-surface-3", seg)}>
              <span className="absolute inset-y-0 left-0 bg-ink-2" style={{ width: `${fill * 100}%` }} />
            </span>
          );
        })}
      </span>
    );
  }
  return (
    <fieldset
      className={cx("inline-flex overflow-hidden rounded-sm border border-line-strong", className)}
      aria-label={label}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const on = value !== null && n <= Math.round(value);
        return (
          <button
            key={n}
            type="button"
            aria-pressed={value !== null && Math.round(value) === n}
            aria-label={`${n} of 5`}
            disabled={disabled}
            onClick={() => onChange(n)}
            className={cx(
              "num h-7 w-8 border-r border-line-strong text-sm font-medium transition-colors last:border-r-0 disabled:opacity-50",
              on ? "bg-accent text-accent-ink" : "bg-surface text-ink-2 hover:bg-surface-3",
            )}
          >
            {n}
          </button>
        );
      })}
    </fieldset>
  );
}
