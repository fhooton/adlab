import type { ReactNode } from "react";
import { cx } from "./cx";

export interface TabItem<T extends string = string> {
  id: T;
  label: ReactNode;
  /** Small tabular count after the label. */
  count?: number;
}

export interface TabsProps<T extends string = string> {
  items: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  /** "underline" for page sections, "segmented" for compact filters. */
  variant?: "underline" | "segmented";
  className?: string;
  "aria-label"?: string;
}

/** Tab strip / segmented filter. Arrow keys move between tabs. */
export function Tabs<T extends string = string>({
  items,
  value,
  onChange,
  variant = "underline",
  className,
  ...aria
}: TabsProps<T>) {
  const move = (dir: 1 | -1) => {
    const i = items.findIndex((t) => t.id === value);
    const next = items[(i + dir + items.length) % items.length];
    if (next) onChange(next.id);
  };
  return (
    <div
      role="tablist"
      aria-label={aria["aria-label"]}
      className={cx(
        variant === "underline"
          ? "flex gap-4 border-b border-line"
          : "inline-flex w-fit rounded-sm border border-line bg-surface-3 p-0.5",
        className,
      )}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") move(1);
        if (e.key === "ArrowLeft") move(-1);
      }}
    >
      {items.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.id)}
            className={cx(
              "inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-medium transition-colors",
              variant === "underline"
                ? cx(
                    "-mb-px border-b-2 pb-2 pt-1",
                    active ? "border-ink text-ink" : "border-transparent text-ink-3 hover:text-ink-2",
                  )
                : cx(
                    "h-6 rounded-xs px-2",
                    active ? "bg-surface text-ink shadow-xs" : "text-ink-3 hover:text-ink-2",
                  ),
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span className={cx("num text-xs", active ? "text-ink-2" : "text-ink-4")}>{t.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
