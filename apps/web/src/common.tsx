import type { AspectRatio, Brief } from "@adlab/contracts";
import { Badge, EmptyState, Notice, PageBody, VariantPlayer } from "@adlab/ui";
import type { ReactNode } from "react";
import { Link } from "react-router";
import type { ApiError } from "./api";
import * as api from "./api";
import { usePoll } from "./hooks";
import type { AssetView, VariantListItem } from "./types";

/** "tst_gyuy5j6zsz6h" -> "gyuy5j" — enough to tell rows apart. */
export const shortId = (id: string) => id.replace(/^[a-z]+_/, "").slice(0, 6);

export function IdText({ id, className }: { id: string; className?: string }) {
  return (
    <span className={`num text-xs text-ink-3 ${className ?? ""}`} title={id}>
      {id}
    </span>
  );
}

/** Loading / error / content switch with a skeleton that keeps layout stable. */
export function Loadable<T>({
  state,
  children,
  skeleton,
}: {
  state: { data: T | undefined; error: ApiError | undefined; loading: boolean };
  children: (data: T) => ReactNode;
  skeleton?: ReactNode;
}) {
  if (state.data !== undefined) return <>{children(state.data)}</>;
  if (state.error) {
    if (state.error.status === 404)
      return (
        <EmptyState
          title="Not found"
          description={state.error.message}
          action={
            <Link to="/" className="link text-sm">
              Back to overview
            </Link>
          }
        />
      );
    return (
      <PageBody className="pt-8">
        <Notice tone="failed" title="Could not load this page">
          {state.error.message}
        </Notice>
      </PageBody>
    );
  }
  return <>{skeleton ?? <SkeletonPage />}</>;
}

export function SkeletonPage() {
  return (
    <div className="flex animate-pulse flex-col gap-4 px-8 pt-8" aria-busy="true">
      <div className="h-5 w-48 rounded-xs bg-surface-3" />
      <div className="h-3 w-80 rounded-xs bg-surface-3" />
      <div className="mt-4 h-20 rounded-md bg-surface-3" />
      <div className="h-64 rounded-md bg-surface-3" />
    </div>
  );
}

/** Brief id -> product name, polled with everything else. */
export function useBriefs() {
  const state = usePoll(() => api.run("briefList"), []);
  const byId = new Map<string, Brief>((state.data ?? []).map((b) => [b.id, b]));
  return { ...state, byId, name: (id: string) => byId.get(id)?.product ?? shortId(id) };
}

export function actorTone(kind: string) {
  return kind === "human" ? "running" : kind === "agent" ? "nmd" : "neutral";
}

export function ActorBadge({ name, kind }: { name: string; kind: string }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <span className="truncate text-ink">{name}</span>
      <Badge tone={actorTone(kind)}>{kind}</Badge>
    </span>
  );
}

const isVideo = (a: AssetView) => a.kind === "video" || a.url.endsWith(".mp4");

export function assetFor(v: VariantListItem, aspect?: string): AssetView | undefined {
  const want = aspect ?? v.aspectRatios[0];
  return v.assets.find((a) => a.aspect === want) ?? v.assets[0];
}

/** Rendered asset (svg poster -> img, mp4 -> player) or the live composition preview. */
export function VariantMedia({
  variant,
  aspect,
  controls = false,
  live = false,
}: {
  variant: VariantListItem;
  aspect?: AspectRatio;
  controls?: boolean;
  live?: boolean;
}) {
  const a = (aspect ?? variant.aspectRatios[0] ?? "9:16") as AspectRatio;
  const asset = live ? undefined : assetFor(variant, a);
  if (asset && isVideo(asset))
    return <VariantPlayer src={asset.url} type="video/mp4" aspect={asset.aspect} controls={controls} />;
  if (asset)
    return <img src={asset.url} alt={variant.label} loading="lazy" className="h-full w-full object-cover" />;
  return <VariantPlayer src={api.previewUrl(variant.id, a)} aspect={a} controls={controls} />;
}

export function formatDuration(seconds: number | null | undefined) {
  if (seconds === null || seconds === undefined) return null;
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function TestLink({ id, children }: { id: string; children?: ReactNode }) {
  return (
    <Link to={`/tests/${id}`} className="link" onClick={(e) => e.stopPropagation()}>
      {children ?? <span className="num text-xs">{id}</span>}
    </Link>
  );
}
