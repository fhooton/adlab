import {
  Badge,
  createColumnHelper,
  DataTable,
  EmptyState,
  formatDateTime,
  PageBody,
  PageHeader,
  StatusBadge,
  Tabs,
  type Tone,
} from "@adlab/ui";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import * as api from "../api";
import { Loadable } from "../common";
import { usePoll } from "../hooks";
import type { LearningView } from "../types";

const col = createColumnHelper<LearningView>();
const CONFIDENCE: Record<string, { bars: number; tone: Tone }> = {
  low: { bars: 1, tone: "nmd" },
  medium: { bars: 2, tone: "running" },
  high: { bars: 3, tone: "won" },
};

function ConfidenceLevel({ level }: { level: string }) {
  const c = CONFIDENCE[level] ?? { bars: 0, tone: "neutral" as Tone };
  return (
    <span className="inline-flex items-center gap-1.5" title={`${level} confidence`}>
      <span className="inline-flex items-end gap-px" aria-hidden="true">
        {[1, 2, 3].map((n) => (
          <span
            key={n}
            className={`w-1 rounded-[1px] ${n <= c.bars ? "bg-ink-2" : "bg-surface-3"}`}
            style={{ height: 4 + n * 3 }}
          />
        ))}
      </span>
      <span className="text-sm capitalize text-ink-2">{level}</span>
    </span>
  );
}

function Evidence({ id }: { id: string }) {
  if (id.startsWith("tst_"))
    return (
      <Link to={`/tests/${id}`} className="link num text-xs">
        {id}
      </Link>
    );
  return <span className="num text-xs text-ink-2">{id}</span>;
}

export function LearningsView() {
  const state = usePoll(() => api.run("learningList"), []);
  const [filter, setFilter] = useState("all");
  const all = state.data ?? [];
  const rows =
    filter === "all"
      ? all
      : filter === "stale"
        ? all.filter((l) => l.stale)
        : all.filter((l) => l.status === filter);

  const columns = useMemo(
    () =>
      col.columns([
        col.accessor("statement", {
          header: "Learning",
          cell: (c) => <span className="text-ink">{c.getValue()}</span>,
          meta: { wrap: true },
        }),
        col.accessor("confidence", {
          header: "Confidence",
          cell: (c) => <ConfidenceLevel level={c.getValue()} />,
          meta: { width: 120 },
          sortFn: (a, b) =>
            (CONFIDENCE[a.original.confidence]?.bars ?? 0) - (CONFIDENCE[b.original.confidence]?.bars ?? 0),
        }),
        col.accessor((l) => l.evidenceIds.join(" "), {
          id: "evidence",
          header: "Evidence",
          cell: ({ row }) => (
            <span className="flex flex-col gap-0.5">
              {row.original.evidenceIds.map((id) => (
                <Evidence key={id} id={id} />
              ))}
            </span>
          ),
          enableSorting: false,
          meta: { width: 160, wrap: true },
        }),
        col.accessor((l) => Object.values(l.tags ?? {}).join(" "), {
          id: "tags",
          header: "Tags",
          cell: ({ row }) => (
            <span className="flex flex-wrap gap-1">
              {Object.entries(row.original.tags ?? {}).map(([k, v]) => (
                <Badge key={k} outline title={k}>
                  {String(v)}
                </Badge>
              ))}
              {!row.original.tags && <span className="text-ink-4">—</span>}
            </span>
          ),
          enableSorting: false,
          meta: { width: 180, wrap: true },
        }),
        col.accessor("status", {
          header: "Status",
          cell: ({ row }) => (
            <span className="flex flex-wrap gap-1">
              <StatusBadge status={row.original.status} />
              {row.original.stale && (
                <Badge tone="pending" title="No review in 60 days">
                  Stale
                </Badge>
              )}
            </span>
          ),
          meta: { width: 140, wrap: true },
        }),
        col.accessor("createdBy", {
          header: "By",
          cell: (c) => <span className="text-ink-2">{c.getValue()}</span>,
          meta: { width: 120 },
        }),
        col.accessor("createdAt", {
          header: "Recorded",
          cell: (c) => <span className="text-ink-2">{formatDateTime(c.getValue())}</span>,
          meta: { width: 120 },
        }),
      ]),
    [],
  );

  const count = (f: string) =>
    f === "all"
      ? all.length
      : f === "stale"
        ? all.filter((l) => l.stale).length
        : all.filter((l) => l.status === f).length;

  return (
    <>
      <PageHeader
        title="Learnings"
        subtitle="What we now believe, stated so it can be wrong, each linked to the tests behind it. Flagged first; unreviewed for 60 days counts as stale."
      />
      <PageBody>
        <Tabs
          variant="segmented"
          value={filter}
          onChange={setFilter}
          items={["all", "active", "flagged", "stale", "retired"].map((f) => ({
            id: f,
            label: f.charAt(0).toUpperCase() + f.slice(1),
            count: count(f),
          }))}
          aria-label="Filter learnings"
        />
        <Loadable state={state}>
          {() => (
            <DataTable
              data={rows}
              columns={columns}
              getRowId={(l) => l.id}
              rowClassName={(l) => (l.status === "flagged" ? "bg-failed-bg/40" : undefined)}
              empty={
                <EmptyState
                  compact
                  title="No learnings yet"
                  description="Agents record learnings after a test ends, with evidence links and a confidence."
                />
              }
            />
          )}
        </Loadable>
      </PageBody>
    </>
  );
}
