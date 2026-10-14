import type { CSSProperties, DetailedHTMLProps, HTMLAttributes } from "react";
import { cx } from "./cx";

/**
 * JSX typing for the `<hyperframes-player>` custom element (from `@hyperframes/player`).
 * The element itself is registered by the app importing "@hyperframes/player" once.
 */
interface HyperframesPlayerAttributes extends HTMLAttributes<HTMLElement> {
  src?: string;
  type?: string;
  poster?: string;
  controls?: boolean;
  muted?: boolean;
  width?: number | string;
  height?: number | string;
}

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "hyperframes-player": DetailedHTMLProps<HyperframesPlayerAttributes, HTMLElement>;
    }
  }
}

export type Aspect = "9:16" | "4:5" | "1:1" | "16:9";

/** "9:16" -> "9 / 16" for CSS aspect-ratio. */
export function aspectCss(aspect: Aspect | string): string {
  const [w, h] = aspect.split(":");
  return `${w ?? 9} / ${h ?? 16}`;
}

export interface VariantPlayerProps {
  /** A HyperFrames composition URL (live preview) or a rendered video URL. */
  src: string;
  /** "video/mp4" for rendered files; omit for compositions. */
  type?: string;
  poster?: string;
  aspect: Aspect;
  /** Show transport controls (default true). */
  controls?: boolean;
  muted?: boolean;
  className?: string;
  style?: CSSProperties;
}

/** Wraps `<hyperframes-player>`, sized by aspect ratio. Plays compositions and mp4s. */
export function VariantPlayer({
  src,
  type,
  poster,
  aspect,
  controls = true,
  muted = true,
  className,
  style,
}: VariantPlayerProps) {
  return (
    <div
      className={cx("relative overflow-hidden bg-[#0d0d0f]", className)}
      style={{ aspectRatio: aspectCss(aspect), ...style }}
    >
      <hyperframes-player
        key={`${src}|${type ?? ""}`}
        src={src}
        type={type}
        poster={poster}
        controls={controls || undefined}
        muted={muted || undefined}
        style={{ display: "block", position: "absolute", inset: 0, width: "100%", height: "100%" }}
      />
    </div>
  );
}
