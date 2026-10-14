import type { Test, VariantResult } from "@adlab/contracts";
import {
  Badge,
  ConfidenceBar,
  Count,
  createColumnHelper,
  DataTable,
  EmptyState,
  formatDateTime,
  formatMoney,
  formatNumber,
  formatPercent,
  formatRelative,
  humanize,
  intervalScale,
  Meter,
  MetricCard,
  MetricGrid,
  Money,
  PageBody,
  PageHeader,
  Percent,
  Stat,
  StatusBadge,
  Tabs,
  type Tone,
} from "@adlab/ui";
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import * as api from "../api";
import { Loadable, useBriefs } from "../common";
import { useNow, usePoll } from "../hooks";

const tcol = createColumnHelper<Test & { brief: string }>();

export function TestsView() {
  const navigate = useNavigate();
  const briefs = useBriefs();
  const state = usePoll(() => api.run("testList", {}), []);
  const [filter, setFilter] = useState("all");
  const all = (state.data ?? []).map((t) => ({ ...t, brief: briefs.name(t.briefId) }));
  const statuses = [...new Set(all.map((t) => t.status))];
  const rows = filter === "all" ? all : all.filter((t) => t.status === filter);

  const columns = useMemo(
    () =>
      tcol.columns([
        tcol.accessor("brief", {
          header: "Test",
          cell: ({ row }) => (
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-medium">{row.original.brief}</span>
              <span className="num truncate text-xs text-ink-3">{row.original.id}</span>
            </span>
          ),
          meta: { width: "26%" },
        }),
        tcol.accessor("stage", {
          header: "Stage",
          cell: (c) => `Stage ${c.getValue()}`,
          meta: { width: 80 },
        }),
        tcol.accessor("status", {
          header: "Status",
          cell: (c) => <StatusBadge status={c.getValue()} />,
          meta: { width: 130 },
        }),
        tcol.accessor("platform", { header: "Platform", meta: { width: 90 } }),
        tcol.accessor((t) => t.variantIds.length, {
          id: "variants",
          header: "Variants",
          meta: { align: "right", width: 80 },
        }),
        tcol.accessor("budgetCents", {
          header: "Budget",
          cell: (c) => <Money cents={c.getValue()} />,
          meta: { align: "right", width: 100 },
        }),
        tcol.accessor("durationHours", {
          header: "Duration",
          cell: (c) => `${c.getValue()}h`,
          meta: { align: "right", width: 80 },
        }),
        tcol.accessor("ruleVersion", {
          header: "Rules",
          cell: (c) => <span className="num text-xs text-ink-2">{c.getValue()}</span>,
          meta: { width: 110 },
        }),
        tcol.accessor((t) => t.startedAt ?? "", {
          id: "startedAt",
          header: "Started",
          cell: (c) => <span className="text-ink-2">{formatDateTime(c.getValue() || null)}</span>,
          meta: { width: 130 },
        }),
        tcol.accessor((t) => t.endedAt ?? "", {
          id: "endedAt",
          header: "Ended",
          cell: (c) => <span className="text-ink-2">{formatDateTime(c.getValue() || null)}</span>,
          meta: { width: 130 },
        }),
      ]),
    [],
  );

  return (
    <>
      <PageHeader
        title="Tests"
        subtitle="Bounded tests with a lifetime budget. Stage 1 filters on attention (hook rate); stage 2 on conversions."
      />
      <PageBody>
        <Tabs
          variant="segmented"
          value={filter}
          onChange={setFilter}
          items={[
            { id: "all", label: "All", count: all.length },
            ...statuses.map((s) => ({
              id: s,
              label: humanize(s),
              count: all.filter((t) => t.status === s).length,
            })),
          ]}
          aria-label="Filter by status"
        />
        <Loadable state={state}>
          {() => (
            <DataTable
              data={rows}
              columns={columns}
              getRowId={(t) => t.id}
              initialSorting={[{ id: "startedAt", desc: true }]}
              columnToggle
              initialHidden={["platform", "endedAt"]}
              onRowClick={(t) => navigate(`/tests/${t.id}`)}
              empty={
                <EmptyState
                  compact
                  title="No tests"
                  description="Agents create tests over rendered variants, run pre-flight, then request launch."
                />
              }
            />
          )}
        </Loadable>
      </PageBody>
    </>
  );
}

// ---------------------------------------------------------------------------

type Evidence = { label: string; tone: Tone; title: string };

/** Per-variant evidence: need more data, vs-control significance from non-overlapping intervals. */
function evidenceFor(v: VariantResult, control: VariantResult | undefined): Evidence {
  if (!v.enoughEvidence || !v.interval)
    return {
      label: "Need more data",
      tone: "nmd",
      title: "Not enough impressions / events for this stage's rule set",
    };
  if (v.isControl || !control?.interval || !control.enoughEvidence) {
    if ((v.probBest ?? 0) >= 0.95) return { label: "Likely best", tone: "won", title: "P(best) ≥ 95%" };
    return {
      label: v.isControl ? "Baseline" : "Not significant",
      tone: "neutral",
      title: "Compared on P(best) only",
    };
  }
  if (v.interval.low > control.interval.high)
    return { label: "Beats control", tone: "won", title: "Interval entirely above the control's" };
  if (v.interval.high < control.interval.low)
    return { label: "Below control", tone: "killed", title: "Interval entirely below the control's" };
  return { label: "Not significant", tone: "neutral", title: "Interval overlaps the control's" };
}

interface ResultRow extends VariantResult {
  evidence: Evidence;
}

const rcol = createColumnHelper<ResultRow>();

const ratio = (a: number, b: number) => (b > 0 ? a / b : null);

export function TestDetailView() {
  const { id = "" } = useParams();
  const now = useNow();
  const navigate = useNavigate();
  const briefs = useBriefs();
  const state = usePoll(() => api.run("testGet", { testId: id }), [id]);

  const data = state.data;
  const control = data?.variants.find((v) => v.isControl);
  const rows = useMemo<ResultRow[]>(
    () => (data?.variants ?? []).map((v) => ({ ...v, evidence: evidenceFor(v, control) })),
    [data, control],
  );
  const scale = useMemo(() => intervalScale(rows.map((r) => r.interval)), [rows]);
  const leader = [...rows].sort((a, b) => (b.probBest ?? -1) - (a.probBest ?? -1))[0];
  const primary = rows[0]?.primaryMetric ?? "hookRate";

  const totals = useMemo(() => {
    const t = { impressions: 0, spendCents: 0, views3s: 0, views15s: 0, clicks: 0, conversions: 0 };
    for (const r of rows) {
      t.impressions += r.metrics.impressions;
      t.spendCents += r.metrics.spendCents;
      t.views3s += r.metrics.views3s;
      t.views15s += r.metrics.views15s;
      t.clicks += r.metrics.clicks;
      t.conversions += r.metrics.conversions;
    }
    return t;
  }, [rows]);

  const columns = useMemo(
    () =>
      rcol.columns([
        rcol.accessor("label", {
          header: "Variant",
          cell: ({ row }) => (
            <span className="flex min-w-0 items-center gap-1.5">
              <Link
                to={`/variants/${row.original.variantId}`}
                className="truncate font-medium hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {row.original.label}
              </Link>
              {row.original.isControl && <Badge tone="running">Control</Badge>}
            </span>
          ),
          footer: () => <span>Total · {rows.length} variants</span>,
          meta: { label: "Variant" },
        }),
        rcol.accessor((r) => r.metrics.impressions, {
          id: "impressions",
          header: "Impr.",
          cell: (c) => formatNumber(c.getValue()),
          footer: () => formatNumber(totals.impressions),
          meta: { align: "right", width: 72, label: "Impressions" },
        }),
        rcol.accessor((r) => r.metrics.spendCents, {
          id: "spend",
          header: "Spend",
          cell: (c) => formatMoney(c.getValue()),
          footer: () => formatMoney(totals.spendCents),
          meta: { align: "right", width: 78 },
        }),
        rcol.accessor((r) => r.rates.hookRate, {
          id: "hookRate",
          header: "Hook",
          cell: (c) => <Percent value={c.getValue()} />,
          footer: () => formatPercent(ratio(totals.views3s, totals.impressions)),
          meta: { align: "right", width: 60, label: "Hook rate" },
          sortUndefined: "last",
        }),
        rcol.accessor((r) => r.rates.holdRate, {
          id: "holdRate",
          header: "Hold",
          cell: (c) => <Percent value={c.getValue()} />,
          footer: () => formatPercent(ratio(totals.views15s, totals.views3s)),
          meta: { align: "right", width: 60, label: "Hold rate" },
        }),
        rcol.accessor((r) => r.rates.ctr, {
          id: "ctr",
          header: "CTR",
          cell: (c) => <Percent value={c.getValue()} digits={2} />,
          footer: () => formatPercent(ratio(totals.clicks, totals.impressions), 2),
          meta: { align: "right", width: 60 },
        }),
        rcol.accessor((r) => r.rates.cvr, {
          id: "cvr",
          header: "CVR",
          cell: (c) => <Percent value={c.getValue()} digits={1} />,
          footer: () => formatPercent(ratio(totals.conversions, totals.clicks)),
          meta: { align: "right", width: 60 },
        }),
        rcol.accessor((r) => r.rates.cpaCents, {
          id: "cpa",
          header: "CPA",
          cell: (c) => <Money cents={c.getValue()} />,
          footer: () => formatMoney(totals.conversions ? totals.spendCents / totals.conversions : null),
          meta: { align: "right", width: 70 },
        }),
        rcol.accessor((r) => r.interval?.mean ?? null, {
          id: "interval",
          header: primary === "hookRate" ? "Hook rate · 90% interval" : "Conv / impr · 90% interval",
          cell: ({ row }) => (
            <ConfidenceBar
              interval={row.original.interval}
              scale={scale}
              enoughEvidence={row.original.enoughEvidence}
              format={(n) => formatPercent(n, primary === "hookRate" ? 1 : 2)}
              reference={row.original.isControl ? null : (control?.interval?.mean ?? null)}
              tone={
                row.original.isControl
                  ? "control"
                  : row.original.variantId === leader?.variantId && (leader?.probBest ?? 0) >= 0.5
                    ? "won"
                    : row.original.latestDecision?.action === "kill"
                      ? "killed"
                      : "default"
              }
              width={92}
            />
          ),
          meta: { width: 196, label: "Interval" },
        }),
        rcol.accessor("probBest", {
          header: "P(best)",
          cell: (c) => (
            <Percent
              value={c.getValue()}
              digits={0}
              className={(c.getValue() ?? 0) >= 0.5 ? "font-medium" : undefined}
            />
          ),
          meta: { align: "right", width: 64 },
        }),
        rcol.accessor((r) => r.evidence.label, {
          id: "evidence",
          header: "Evidence",
          cell: ({ row }) => (
            <Badge tone={row.original.evidence.tone} title={row.original.evidence.title}>
              {row.original.evidence.label}
            </Badge>
          ),
          meta: { width: 108 },
        }),
        rcol.accessor((r) => r.latestDecision?.action ?? "", {
          id: "decision",
          header: "Decision",
          cell: ({ row }) => {
            const d = row.original.latestDecision;
            if (!d) return <span className="text-ink-4">hold</span>;
            return (
              <span className="flex items-center gap-1.5" title={d.reason}>
                <StatusBadge status={d.action} label={d.action.toUpperCase()} />
                <span className="truncate text-xs text-ink-3">{humanize(d.status)}</span>
              </span>
            );
          },
          meta: { width: 128 },
        }),
      ]),
    [rows.length, totals, primary, scale, control, leader],
  );

  return (
    <Loadable state={state}>
      {(r) => {
        const t = r.test;
        const pendingDecisions = rows.filter((x) => x.latestDecision?.status === "pending_approval").length;
        const enough = rows.filter((x) => x.enoughEvidence).length;
        return (
          <>
            <PageHeader
              eyebrow={
                <span className="flex items-center gap-1.5">
                  <Link to="/tests" className="hover:text-ink">
                    Tests
                  </Link>
                  <span className="text-ink-4">/</span>
                  <Link to={`/briefs/${t.briefId}`} className="hover:text-ink">
                    {briefs.name(t.briefId)}
                  </Link>
                </span>
              }
              title={`Stage ${t.stage} test`}
              badges={
                <>
                  <StatusBadge status={t.status} />
                  <span className="num text-xs text-ink-3">{t.id}</span>
                </>
              }
              subtitle={t.structure}
              meta={
                <>
                  <Stat inline label="Budget">
                    <Money cents={t.budgetCents} />
                  </Stat>
                  <Stat inline label="Duration">
                    <span className="num">{t.durationHours}h</span>
                  </Stat>
                  <Stat inline label="Rules">
                    <span className="num text-sm">{t.ruleVersion}</span>
                  </Stat>
                  <Stat inline label="Platform">
                    {t.platform}
                  </Stat>
                  <Stat inline label="Started">
                    {formatDateTime(t.startedAt)}
                  </Stat>
                  {t.endedAt && (
                    <Stat inline label="Ended">
                      {formatDateTime(t.endedAt)}
                    </Stat>
                  )}
                  <Stat inline label="Last synced">
                    {formatRelative(r.lastSyncedAt, now)}
                  </Stat>
                </>
              }
            />
            <PageBody>
              <Meter
                value={r.totalSpendCents}
                max={t.budgetCents}
                warnAt={1.01}
                label="Spend against lifetime budget"
                valueLabel={`${formatMoney(r.totalSpendCents)} of ${formatMoney(t.budgetCents)} · ${t.budgetCents ? Math.round((r.totalSpendCents / t.budgetCents) * 100) : 0}%`}
              />
              <MetricGrid columns={6}>
                <MetricCard
                  label="Spend"
                  value={<Money cents={r.totalSpendCents} />}
                  hint={`of ${formatMoney(t.budgetCents, { whole: true })}`}
                />
                <MetricCard label="Impressions" value={<Count value={totals.impressions} />} />
                <MetricCard
                  label={primary === "hookRate" ? "Pooled hook rate" : "Pooled CVR"}
                  value={
                    primary === "hookRate"
                      ? formatPercent(ratio(totals.views3s, totals.impressions))
                      : formatPercent(ratio(totals.conversions, totals.clicks))
                  }
                />
                <MetricCard
                  label="Leader"
                  value={
                    <span className="font-sans text-md">
                      {leader?.probBest !== null && leader?.probBest !== undefined ? leader.label : "—"}
                    </span>
                  }
                  hint={
                    leader?.probBest !== null && leader?.probBest !== undefined
                      ? `P(best) ${formatPercent(leader.probBest, 0)}`
                      : "Need more data"
                  }
                  tone={(leader?.probBest ?? 0) >= 0.95 ? "won" : undefined}
                />
                <MetricCard
                  label="Enough evidence"
                  value={`${enough} / ${rows.length}`}
                  hint="variants past the rule's minimums"
                />
                <MetricCard
                  label="Decisions awaiting approval"
                  value={<Count value={pendingDecisions} />}
                  tone={pendingDecisions ? "pending" : undefined}
                  onClick={pendingDecisions ? () => navigate("/approvals") : undefined}
                />
              </MetricGrid>
              <DataTable
                data={rows}
                columns={columns}
                getRowId={(x) => x.variantId}
                totals
                columnToggle
                initialSorting={[{ id: "probBest", desc: true }]}
                rowClassName={(x) =>
                  x.latestDecision?.action === "kill" && x.latestDecision.status === "applied"
                    ? "opacity-60"
                    : undefined
                }
                toolbar={
                  <span className="flex items-baseline gap-2">
                    <span className="text-sm font-semibold">Results by variant</span>
                    <span className="text-xs text-ink-3">
                      primary metric:{" "}
                      {primary === "hookRate"
                        ? "hook rate (3s views / impressions)"
                        : "conversions per impression"}
                    </span>
                  </span>
                }
                empty={<EmptyState compact title="No variants" />}
              />
            </PageBody>
          </>
        );
      }}
    </Loadable>
  );
}
