import type { ReactNode } from "react";
import { StatusBadge } from "./Badge";
import { cx } from "./cx";
import { Rating } from "./Rating";
import { type Aspect, aspectCss } from "./VariantPlayer";

export interface VariantCardProps {
  /** The media: <img>, <VariantPlayer> or a placeholder. Fills the frame. */
  media: ReactNode;
  aspect?: Aspect;
  label: ReactNode;
  /** Secondary line, e.g. the hook text or hypothesis. */
  sublabel?: ReactNode;
  tags?: string[];
  status: string;
  /** Average rating 1–5, or null. */
  rating: number | null;
  isControl?: boolean;
  /** Overlay at the bottom-right of the media, e.g. duration "0:10". */
  mediaBadge?: ReactNode;
  /** Extra metadata line (e.g. renderer, spec hash). */
  meta?: ReactNode;
  selected?: boolean;
  onClick?: () => void;
  /** Use an anchor instead of a button when navigating. */
  href?: string;
  className?: string;
}

/** Frame.io-style tile: media first, then label, status, tags, rating. */
export function VariantCard({
  media,
  aspect = "9:16",
  label,
  sublabel,
  tags = [],
  status,
  rating,
  isControl,
  mediaBadge,
  meta,
  selected,
  onClick,
  href,
  className,
}: VariantCardProps) {
  const body = (
    <>
      <div
        className="relative overflow-hidden rounded-sm bg-surface-3"
        style={{ aspectRatio: aspectCss(aspect) }}
      >
        <div className="absolute inset-0 [&>*]:h-full [&>*]:w-full [&_img]:object-cover">{media}</div>
        {isControl && (
          <span className="absolute top-1.5 left-1.5 rounded-xs bg-[rgb(0_0_0/0.62)] px-1.5 py-0.5 text-2xs font-medium uppercase tracking-wide text-white">
            Control
          </span>
        )}
        {mediaBadge && (
          <span className="num absolute right-1.5 bottom-1.5 rounded-xs bg-[rgb(0_0_0/0.62)] px-1 py-0.5 text-2xs text-white">
            {mediaBadge}
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-1.5 px-0.5 pt-2">
        <div className="flex items-start justify-between gap-2">
          <span className="min-w-0 truncate text-sm font-medium text-ink">{label}</span>
          <StatusBadge status={status} />
        </div>
        {sublabel && <span className="line-clamp-2 text-xs text-ink-3">{sublabel}</span>}
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 gap-1 overflow-hidden">
            {tags.slice(0, 3).map((t) => (
              <span
                key={t}
                className="truncate rounded-xs border border-line px-1 text-2xs leading-4 text-ink-3"
              >
                {t}
              </span>
            ))}
          </div>
          <Rating value={rating} />
        </div>
        {meta && <div className="truncate text-2xs text-ink-4">{meta}</div>}
      </div>
    </>
  );
  const cls = cx(
    "group flex min-w-0 flex-col rounded-md border bg-surface p-1.5 pb-2 text-left transition-colors",
    selected ? "border-ink" : "border-line hover:border-line-strong",
    className,
  );
  if (href) {
    return (
      <a
        href={href}
        onClick={
          onClick
            ? (e) => {
                if (e.metaKey || e.ctrlKey) return;
                e.preventDefault();
                onClick();
              }
            : undefined
        }
        className={cls}
      >
        {body}
      </a>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cls}>
        {body}
      </button>
    );
  }
  return <div className={cls}>{body}</div>;
}
