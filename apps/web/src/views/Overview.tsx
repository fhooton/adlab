import type { AuditEntry, TestResults } from "@adlab/contracts";
import {
  Count,
  createColumnHelper,
  DataTable,
  EmptyState,
  formatMoney,
  formatRelative,
  Meter,
  MetricCard,
  MetricGrid,
  Money,
  PageBody,
  PageHeader,
  Panel,
  Percent,
  Sparkline,
  Stat,
  StatusBadge,
} from "@adlab/ui";
import { useMemo } from "react";
import { Link, useNavigate } from "react-router";
import * as api from "../api";
import { ActorBadge, Loadable, useBriefs } from "../common";
import { useNow, usePoll } from "../hooks";
import { useOverview } from "../shell";

interface RunningRow {
  results: TestResults;
  brief: string;
  leader: { label: string; probBest: number } | null;
}

const col = createColumnHelper<RunningRow>();

function hourlyActivity(entries: AuditEntry[], now: Date, hours = 24) {
  const buckets = new Array<number>(hours).fill(0);
  // Anchor to the newest entry so a simulated platform clock still produces a sensible series.
  const latest = Math.max(now.getTime(), ...entries.map((e) => new Date(e.createdAt).getTime()));
  for (const e of entries) {
    const ago = Math.floor((latest - new Date(e.createdAt).getTime()) / 3_600_000);
    if (ago >= 0 && ago < hours) buckets[hours - 1 - ago] = (buckets[hours - 1 - ago] ?? 0) + 1;
  }
  return buckets;
}

export function OverviewView() {
  const overview = useOverview();
  const briefs = useBriefs();
  const navigate = useNavigate();
  const now = useNow();
  const activity = usePoll(() => api.run("activityList", { limit: 200 }), []);
  const running = usePoll(async () => {
    const tests = (await api.run("testList", {})).filter(
      (t) => t.status === "running" || t.status === "paused" || t.status === "launching",
    );
    return Promise.all(tests.map((t) => api.run("testGet", { testId: t.id })));
  }, []);

  const rows = useMemo<RunningRow[]>(
    () =>
      (running.data ?? []).map((results) => {
        const best = [...results.variants].sort((a, b) => (b.probBest ?? -1) - (a.probBest ?? -1))[0];
        const brief =
          briefs.data?.find((b) => b.id === results.test.briefId)?.product ?? results.test.briefId;
        return {
          results,
          brief,
          leader: best && best.probBest !== null ? { label: best.label, probBest: best.probBest } : null,
        };
      }),
    [running.data, briefs.data],
  );

  const columns = useMemo(
    () =>
      col.columns([
        col.accessor((r) => r.brief, {
          id: "brief",
          header: "Test",
          cell: ({ row }) => (
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-medium">{row.original.brief}</span>
              <span className="num truncate text-xs text-ink-3">{row.original.results.test.id}</span>
            </span>
          ),
          meta: { width: "26%" },
        }),
        col.accessor((r) => r.results.test.stage, {
          id: "stage",
          header: "Stage",
          cell: (c) => `Stage ${c.getValue()}`,
          meta: { width: 72 },
        }),
        col.accessor((r) => r.results.test.status, {
          id: "status",
          header: "Status",
          cell: (c) => <StatusBadge status={c.getValue()} />,
          meta: { width: 100 },
        }),
        col.accessor((r) => r.results.test.variantIds.length, {
          id: "variants",
          header: "Variants",
          meta: { align: "right", width: 72 },
        }),
        col.accessor((r) => r.results.totalSpendCents, {
          id: "spend",
          header: "Spend / budget",
          cell: ({ row }) => (
            <div className="flex flex-col gap-1">
              <span className="text-ink">
                {formatMoney(row.original.results.totalSpendCents)}{" "}
                <span className="text-ink-4">
                  / {formatMoney(row.original.results.test.budgetCents, { whole: true })}
                </span>
              </span>
              <Meter
                size="sm"
                value={row.original.results.totalSpendCents}
                max={row.original.results.test.budgetCents}
                warnAt={1.01}
              />
            </div>
          ),
          meta: { align: "right", width: 180 },
        }),
        col.accessor((r) => r.leader?.label ?? "", {
          id: "leader",
          header: "Leader",
          cell: (c) => c.getValue() || <span className="text-ink-4">—</span>,
        }),
        col.accessor((r) => r.leader?.probBest ?? null, {
          id: "pbest",
          header: "P(best)",
          cell: (c) => <Percent value={c.getValue()} digits={0} />,
          meta: { align: "right", width: 80 },
        }),
        col.accessor((r) => r.results.lastSyncedAt ?? "", {
          id: "synced",
          header: "Last sync",
          cell: (c) => <span className="text-ink-2">{formatRelative(c.getValue() || null, now)}</span>,
          meta: { width: 120 },
        }),
      ]),
    [now],
  );

  return (
    <Loadable state={overview}>
      {(o) => {
        const headroom = Math.max(0, o.week.capCents - o.week.committedCents);
        const series = hourlyActivity(activity.data ?? [], now);
        return (
          <>
            <PageHeader
              title="Overview"
              subtitle={`Week of ${new Date(`${o.week.start}T00:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric" })}. Spend is capped in code; agents request, humans approve.`}
              meta={
                <Stat inline label="Updated">
                  {formatRelative(overview.updatedAt?.toISOString(), now)}
                </Stat>
              }
            />
            <PageBody>
              <Panel title="Spend this week" detail="Account-level weekly cap" padded>
                <div className="grid grid-cols-2 gap-x-8 gap-y-3 md:grid-cols-[repeat(4,auto)_1fr] md:items-end">
                  <Stat label="Actual">
                    <Money cents={o.week.actualCents} className="text-lg font-medium" />
                  </Stat>
                  <Stat label="Committed">
                    <Money cents={o.week.committedCents} className="text-lg font-medium" />
                  </Stat>
                  <Stat label="Cap">
                    <Money cents={o.week.capCents} className="text-lg font-medium" />
                  </Stat>
                  <Stat label="Headroom">
                    <Money cents={headroom} className="text-lg font-medium" />
                  </Stat>
                  <Meter
                    className="col-span-2 md:col-span-1 md:pb-1.5"
                    value={o.week.actualCents}
                    committed={o.week.committedCents}
                    max={o.week.capCents}
                    label={
                      <span className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <span className="size-2 rounded-[1px] bg-ink-2" /> Actual
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="size-2 rounded-[1px] border border-ink-3 opacity-60" /> Committed
                          (lifetime budgets)
                        </span>
                      </span>
                    }
                    valueLabel={`${o.week.capCents ? Math.round((o.week.committedCents / o.week.capCents) * 100) : 0}% committed`}
                  />
                </div>
              </Panel>

              <MetricGrid columns={7}>
                <MetricCard
                  label="Briefs"
                  value={<Count value={o.counts.briefs} />}
                  onClick={() => navigate("/briefs")}
                />
                <MetricCard
                  label="Variants"
                  value={<Count value={o.counts.variants} />}
                  onClick={() => navigate("/variants")}
                />
                <MetricCard
                  label="Running tests"
                  value={<Count value={o.counts.testsRunning} />}
                  onClick={() => navigate("/tests")}
                />
                <MetricCard
                  label="Pending approvals"
                  value={<Count value={o.counts.pendingApprovals} />}
                  tone={o.counts.pendingApprovals > 0 ? "pending" : undefined}
                  hint={o.counts.pendingApprovals > 0 ? "Needs a human" : "Inbox clear"}
                  onClick={() => navigate("/approvals")}
                />
                <MetricCard
                  label="Winners"
                  value={<Count value={o.counts.winners} />}
                  tone={o.counts.winners > 0 ? "won" : undefined}
                />
                <MetricCard
                  label="Cost / variant tested"
                  value={<Money cents={o.costPerVariantTestedCents} />}
                  hint="Media + generation + render"
                />
                <MetricCard
                  label="Cost / winner"
                  value={<Money cents={o.costPerWinnerCents} />}
                  hint="Full cost"
                />
              </MetricGrid>

              <DataTable
                data={rows}
                columns={columns}
                getRowId={(r) => r.results.test.id}
                onRowClick={(r) => navigate(`/tests/${r.results.test.id}`)}
                toolbar={
                  <span className="flex items-baseline gap-2">
                    <span className="text-sm font-semibold">Running tests</span>
                    <span className="num text-xs text-ink-3">{rows.length}</span>
                  </span>
                }
                empty={
                  <EmptyState
                    compact
                    title="No tests running"
                    description="Agents request launches; approved tests appear here while they deliver."
                  />
                }
              />

              <Panel
                title="Latest activity"
                detail={<span className="num">{activity.data?.length ?? 0} writes</span>}
                actions={
                  <span className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5 text-xs text-ink-3">
                      last 24h
                      <Sparkline
                        values={series}
                        width={72}
                        height={16}
                        label="Writes per hour, last 24 hours"
                      />
                    </span>
                    <Link to="/activity" className="link text-xs">
                      All activity
                    </Link>
                  </span>
                }
                padded={false}
              >
                {(activity.data ?? []).length === 0 ? (
                  <EmptyState compact title="No activity yet" />
                ) : (
                  <ul className="divide-y divide-line">
                    {(activity.data ?? []).slice(0, 10).map((e) => (
                      <li
                        key={e.id}
                        className="grid grid-cols-[110px_200px_1fr] items-center gap-3 px-3.5 py-1.5 text-sm"
                      >
                        <span className="num text-xs text-ink-3">{formatRelative(e.createdAt, now)}</span>
                        <ActorBadge name={e.actor} kind={e.actorKind} />
                        <span className="min-w-0 truncate">
                          <span className="num text-xs text-ink">{e.action}</span>
                          {typeof e.detail.summary === "string" && (
                            <span className="text-ink-3"> — {e.detail.summary}</span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </PageBody>
          </>
        );
      }}
    </Loadable>
  );
}
