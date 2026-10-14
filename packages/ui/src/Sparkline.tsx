import { cx } from "./cx";

export interface SparklineProps {
  /** Series values, oldest first. Fewer than two points renders a flat baseline. */
  values: number[];
  width?: number;
  height?: number;
  /** Fill the area under the line with a faint wash. */
  area?: boolean;
  /** Any CSS colour; defaults to the secondary ink colour. */
  color?: string;
  className?: string;
  /** Accessible description, e.g. "Spend over the last 7 days". */
  label?: string;
}

/** Inline SVG sparkline. No chart library, no axes; the last point is marked. */
export function Sparkline({
  values,
  width = 96,
  height = 24,
  area = true,
  color = "var(--color-ink-3)",
  className,
  label,
}: SparklineProps) {
  const pad = 2;
  const pts = values.length >= 2 ? values : [values[0] ?? 0, values[0] ?? 0];
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = max - min || 1;
  const x = (i: number) => pad + (i * (width - pad * 2)) / (pts.length - 1);
  const y = (v: number) => height - pad - ((v - min) / span) * (height - pad * 2);
  const line = pts.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const last = pts.length - 1;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={cx("block overflow-visible", className)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {area && (
        <path
          d={`${line} L${x(last).toFixed(1)},${height - pad} L${x(0).toFixed(1)},${height - pad} Z`}
          fill={color}
          opacity={0.08}
        />
      )}
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={1.25}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={x(last)} cy={y(pts[last] ?? 0)} r={1.75} fill={color} />
    </svg>
  );
}
