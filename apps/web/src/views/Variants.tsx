import type { AspectRatio } from "@adlab/contracts";
import {
  Badge,
  Count,
  EmptyState,
  formatDateTime,
  formatPercent,
  humanize,
  KeyValue,
  Money,
  PageBody,
  PageHeader,
  Panel,
  Rating,
  Select,
  Stat,
  StatusBadge,
  Tabs,
  VariantCard,
  VariantPlayer,
} from "@adlab/ui";
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import * as api from "../api";
import { useAuth } from "../auth";
import { assetFor, formatDuration, Loadable, useBriefs, VariantMedia } from "../common";
import { useAction } from "../feedback";
import { usePoll } from "../hooks";
import type { VariantListItem } from "../types";

const STATUS_FILTERS = [
  "all",
  "live",
  "rendered",
  "ready",
  "won",
  "killed",
  "draft",
  "rendering",
  "render_failed",
] as const;

export function VariantsView() {
  const [params, setParams] = useSearchParams();
  const briefId = params.get("briefId") ?? "";
  const hypothesisId = params.get("hypothesisId") ?? "";
  const status = params.get("status") ?? "all";
  const navigate = useNavigate();
  const briefs = useBriefs();
  const state = usePoll(
    () => api.run("variantsList", { briefId: briefId || undefined, hypothesisId: hypothesisId || undefined }),
    [briefId, hypothesisId],
  );

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value && value !== "all") next.set(key, value);
    else next.delete(key);
    if (key === "briefId") next.delete("hypothesisId");
    setParams(next, { replace: true });
  };

  const all = state.data ?? [];
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const v of all) m.set(v.status, (m.get(v.status) ?? 0) + 1);
    return m;
  }, [all]);
  const visible = status === "all" ? all : all.filter((v) => v.status === status);
  const tabs = STATUS_FILTERS.filter((s) => s === "all" || counts.has(s) || s === status).map((s) => ({
    id: s,
    label: s === "all" ? "All" : humanize(s),
    count: s === "all" ? all.length : (counts.get(s) ?? 0),
  }));

  return (
    <>
      <PageHeader
        title="Variants"
        subtitle="Every variant is data: a template, its variables and copy. Rendered posters and videos appear once the worker renders them."
      />
      <PageBody>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs
            variant="segmented"
            items={tabs}
            value={status}
            onChange={(s) => set("status", s)}
            aria-label="Filter by status"
          />
          <div className="flex items-center gap-2">
            {hypothesisId && (
              <Badge outline>
                Hypothesis {hypothesisId}
                <button
                  type="button"
                  className="ml-1 text-ink-3 hover:text-ink"
                  onClick={() => set("hypothesisId", "")}
                  aria-label="Clear hypothesis filter"
                >
                  ×
                </button>
              </Badge>
            )}
            <Select
              value={briefId}
              onChange={(e) => set("briefId", e.target.value)}
              aria-label="Filter by brief"
            >
              <option value="">All briefs</option>
              {(briefs.data ?? []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.product}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <Loadable state={state}>
          {() =>
            visible.length === 0 ? (
              <EmptyState
                title="No variants match"
                description={
                  all.length
                    ? "Try another status filter."
                    : "Variants appear after a human selects a hypothesis and an agent creates specs."
                }
              />
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(172px,1fr))] gap-3">
                {visible.map((v) => (
                  <VariantTile
                    key={v.id}
                    v={v}
                    brief={briefId ? undefined : briefs.name(v.briefId)}
                    onOpen={() => navigate(`/variants/${v.id}`)}
                  />
                ))}
              </div>
            )
          }
        </Loadable>
      </PageBody>
    </>
  );
}

function VariantTile({ v, brief, onOpen }: { v: VariantListItem; brief?: string; onOpen: () => void }) {
  const asset = assetFor(v);
  const hook = typeof v.variables.hook === "string" ? v.variables.hook : v.copy.headline;
  return (
    <VariantCard
      href={`/variants/${v.id}`}
      onClick={onOpen}
      media={<VariantMedia variant={v} />}
      aspect={(asset?.aspect ?? v.aspectRatios[0] ?? "9:16") as AspectRatio}
      label={v.label}
      sublabel={hook}
      status={v.status}
      rating={v.avgRating}
      isControl={v.isControl}
      tags={[humanize(v.tags.hookType), v.tags.concept]}
      mediaBadge={formatDuration(asset?.durationSeconds) ?? (asset ? undefined : "live")}
      meta={brief ? brief : `${v.templateId} · ${v.specHash.slice(0, 8)}`}
    />
  );
}

export function VariantDetailView() {
  const { id = "" } = useParams();
  const { me } = useAuth();
  const { busy, perform } = useAction();
  const state = usePoll(async () => {
    const [variant, templates] = await Promise.all([
      api.run("variantGet", { variantId: id }),
      api.run("templateList"),
    ]);
    return { variant, template: templates.find((t) => t.id === variant.templateId) ?? null };
  }, [id]);
  const [aspect, setAspect] = useState<AspectRatio | null>(null);
  const [mode, setMode] = useState<"live" | "rendered">("live");

  return (
    <Loadable state={state}>
      {({ variant: v, template }) => {
        const aspects = (template?.aspectRatios ?? v.aspectRatios) as AspectRatio[];
        const current =
          aspect && aspects.includes(aspect) ? aspect : (v.aspectRatios[0] ?? aspects[0] ?? "9:16");
        const rendered = v.assets.find((a) => a.aspect === current);
        const showRendered = mode === "rendered" && rendered;
        const myRating = v.ratings.find((r) => r.rater === me?.name)?.score ?? null;
        const m = v.latestMetrics;
        const rate = (a: number, b: number) => (b > 0 ? a / b : null);
        return (
          <>
            <PageHeader
              eyebrow={
                <span className="flex items-center gap-1.5">
                  <Link to="/variants" className="hover:text-ink">
                    Variants
                  </Link>
                  <span className="text-ink-4">/</span>
                  <Link to={`/briefs/${v.briefId}`} className="hover:text-ink">
                    Brief
                  </Link>
                </span>
              }
              title={v.label}
              badges={
                <>
                  <StatusBadge status={v.status} />
                  {v.isControl && <Badge outline>Control</Badge>}
                </>
              }
              subtitle={v.copy.headline}
              meta={
                <>
                  <Stat inline label="Template">
                    <span className="num text-sm">
                      {v.templateId}@{v.templateVersion}
                    </span>
                  </Stat>
                  <Stat inline label="Spec hash">
                    <span className="num text-sm">{v.specHash}</span>
                  </Stat>
                  <Stat inline label="Created">
                    {formatDateTime(v.createdAt)}
                  </Stat>
                </>
              }
            />
            <PageBody>
              <div className="grid gap-6 lg:grid-cols-[minmax(280px,380px)_minmax(0,1fr)]">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <Tabs
                      variant="segmented"
                      items={[
                        { id: "live", label: "Live preview" },
                        { id: "rendered", label: rendered ? "Rendered" : "Not rendered" },
                      ]}
                      value={showRendered ? "rendered" : "live"}
                      onChange={(m) => setMode(m as "live" | "rendered")}
                      aria-label="Preview source"
                    />
                    <Tabs
                      variant="segmented"
                      items={aspects.map((a) => ({ id: a, label: a }))}
                      value={current}
                      onChange={(a) => setAspect(a as AspectRatio)}
                      aria-label="Aspect ratio"
                    />
                  </div>
                  <div
                    className="mx-auto w-full overflow-hidden rounded-md border border-line"
                    style={{ maxWidth: current === "16:9" ? undefined : current === "1:1" ? 380 : 340 }}
                  >
                    {showRendered && rendered ? (
                      rendered.url.endsWith(".mp4") ? (
                        <VariantPlayer src={rendered.url} type="video/mp4" aspect={current} />
                      ) : (
                        <img
                          src={rendered.url}
                          alt={`${v.label} ${current}`}
                          className="block w-full"
                          style={{ aspectRatio: current.replace(":", " / ") }}
                        />
                      )
                    ) : (
                      <VariantPlayer src={api.previewUrl(v.id, current)} aspect={current} />
                    )}
                  </div>
                  <p className="text-xs text-ink-3">
                    {showRendered
                      ? `Rendered by ${rendered?.renderer} · ${formatDuration(rendered?.durationSeconds) ?? "still"} · cost ${((rendered?.costCents ?? 0) / 100).toFixed(2)} USD`
                      : "Live HyperFrames composition with this variant's variables injected — what the renderer will produce."}
                  </p>
                </div>

                <div className="flex min-w-0 flex-col gap-4">
                  <Panel
                    title="Your rating"
                    detail={
                      v.avgRating !== null
                        ? `avg ${v.avgRating.toFixed(1)} from ${v.ratings.length}`
                        : "unrated"
                    }
                  >
                    <div className="flex flex-wrap items-center gap-4">
                      <Rating
                        value={myRating}
                        size="md"
                        disabled={busy !== null || me?.kind !== "human"}
                        onChange={(score) =>
                          perform(
                            "rate",
                            () => api.call("ratingAdd", { variantId: v.id, score }),
                            `Rated ${score} of 5`,
                          )
                        }
                        label="Rate this variant"
                      />
                      <span className="text-xs text-ink-3">
                        Taste capture: ratings inform which hooks agents try next.
                      </span>
                    </div>
                    {v.ratings.length > 0 && (
                      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                        {v.ratings.map((r) => (
                          <li key={r.rater} className="flex items-center gap-1.5">
                            <span className="text-ink-2">{r.rater}</span>
                            <Rating value={r.score} />
                          </li>
                        ))}
                      </ul>
                    )}
                  </Panel>

                  <Panel
                    title="Latest metrics"
                    detail={m ? `captured ${formatDateTime(m.capturedAt)}` : undefined}
                    padded={!m}
                  >
                    {m ? (
                      <div className="grid grid-cols-3 gap-px bg-line md:grid-cols-6">
                        {(
                          [
                            ["Impressions", <Count key="i" value={m.impressions} />],
                            ["Spend", <Money key="s" cents={m.spendCents} />],
                            ["Hook rate", formatPercent(rate(m.views3s, m.impressions))],
                            ["Hold rate", formatPercent(rate(m.views15s, m.views3s))],
                            ["CTR", formatPercent(rate(m.clicks, m.impressions), 2)],
                            ["Conversions", <Count key="c" value={m.conversions} />],
                          ] as const
                        ).map(([label, value]) => (
                          <div key={label} className="flex flex-col gap-0.5 bg-surface px-3.5 py-2.5">
                            <span className="text-xs text-ink-3">{label}</span>
                            <span className="num text-md">{value}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-sm text-ink-3">
                        No delivery yet. Metrics appear after the variant runs in a test.
                      </span>
                    )}
                  </Panel>

                  <div className="grid gap-4 xl:grid-cols-2">
                    <Panel title="Copy">
                      <KeyValue
                        items={[
                          ["Headline", v.copy.headline],
                          ["Primary text", v.copy.primaryText],
                          ["Description", v.copy.description ?? <span className="text-ink-4">—</span>],
                          [
                            "CTA",
                            <Badge key="cta" outline>
                              {v.copy.cta}
                            </Badge>,
                          ],
                        ]}
                      />
                    </Panel>
                    <Panel title="Variables" detail={template?.name}>
                      <KeyValue
                        items={Object.entries(v.variables).map(([k, val]) => {
                          const def = template?.variables.find((x) => x.id === k);
                          return [
                            <span key={k} title={k}>
                              {def?.label ?? k}
                            </span>,
                            def?.type === "color" && typeof val === "string" ? (
                              <span key={`${k}v`} className="flex items-center gap-1.5">
                                <span
                                  className="size-3 rounded-xs border border-line"
                                  style={{ background: val }}
                                />
                                <span className="num text-xs">{val}</span>
                              </span>
                            ) : (
                              String(val)
                            ),
                          ];
                        })}
                      />
                    </Panel>
                    <Panel title="Tags" detail="From the spec, never inferred">
                      <KeyValue
                        items={Object.entries(v.tags).map(([k, val]) => [
                          humanize(k),
                          <span key={k}>{String(val)}</span>,
                        ])}
                      />
                    </Panel>
                    <Panel title="Provenance">
                      <KeyValue
                        items={[
                          [
                            "Skill",
                            <span
                              key="s"
                              className="num text-xs"
                            >{`${v.generator.skill}@${v.generator.skillVersion}`}</span>,
                          ],
                          [
                            "Model",
                            <span key="m" className="num text-xs">
                              {v.generator.model}
                            </span>,
                          ],
                          [
                            "Prompt hash",
                            <span key="p" className="num text-xs">
                              {v.generator.promptHash ?? "—"}
                            </span>,
                          ],
                          [
                            "Hypothesis",
                            <span key="h" className="num text-xs">
                              {v.hypothesisId}
                            </span>,
                          ],
                          [
                            "Spec hash",
                            <span key="sh" className="num text-xs">
                              {v.specHash}
                            </span>,
                          ],
                          [
                            "Variant id",
                            <span key="id" className="num text-xs">
                              {v.id}
                            </span>,
                          ],
                          [
                            "Assets",
                            v.assets.length
                              ? v.assets.map((a) => `${a.aspect} ${a.kind} (${a.renderer})`).join(", ")
                              : "none yet",
                          ],
                        ]}
                      />
                    </Panel>
                  </div>
                </div>
              </div>
            </PageBody>
          </>
        );
      }}
    </Loadable>
  );
}
