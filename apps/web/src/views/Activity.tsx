import type { AuditEntry } from "@adlab/contracts";
import {
  Badge,
  Button,
  Count,
  createColumnHelper,
  DataTable,
  EmptyState,
  formatDateTime,
  formatMoney,
  formatRelative,
  Money,
  Notice,
  PageBody,
  PageHeader,
  Panel,
  Tabs,
} from "@adlab/ui";
import { type ReactNode, useMemo, useState } from "react";
import { Link } from "react-router";
import * as api from "../api";
import { ActorBadge, Loadable } from "../common";
import { useAction } from "../feedback";
import { useNow, usePoll } from "../hooks";

const col = createColumnHelper<AuditEntry>();

const TARGET_ROUTE: Record<string, string> = {
  brief: "/briefs/",
  test: "/tests/",
  variant: "/variants/",
  approval: "/approvals?status=all&id=",
};

/** One readable line from an audit entry's detail object. */
function describe(detail: Record<string, unknown>): string {
  if (typeof detail.summary === "string") return detail.summary;
  if (typeof detail.message === "string") return detail.message;
  return Object.entries(detail)
    .filter(([, v]) => v !== null && v !== undefined && typeof v !== "object")
    .slice(0, 5)
    .map(([k, v]) => `${k}=${k.endsWith("Cents") && typeof v === "number" ? formatMoney(v) : String(v)}`)
    .join("  ");
}

function DigestList({ title, items, tone }: { title: string; items: string[]; tone?: "failed" }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="flex items-baseline gap-1.5 text-xs text-ink-3">
        {title} <span className="num text-ink-2">{items.length}</span>
      </span>
      {items.length === 0 ? (
        <span className="text-sm text-ink-4">None</span>
      ) : (
        <ul className="flex flex-col gap-0.5 text-sm">
          {items.slice(0, 6).map((x) => (
            <li key={x} className={`truncate ${tone === "failed" ? "text-failed" : "text-ink"}`} title={x}>
              {x}
            </li>
          ))}
          {items.length > 6 && <li className="text-xs text-ink-3">+{items.length - 6} more</li>}
        </ul>
      )}
    </div>
  );
}

export function ActivityView() {
  const now = useNow();
  const [hours, setHours] = useState("24");
  const [kind, setKind] = useState("all");
  const { busy, perform } = useAction();
  const digest = usePoll(() => api.run("digestGet", { hours: Number(hours) }), [hours]);
  const activity = usePoll(() => api.run("activityList", { limit: 300 }), []);
  const entries = activity.data ?? [];
  const rows = kind === "all" ? entries : entries.filter((e) => e.actorKind === kind);

  const columns = useMemo(
    () =>
      col.columns([
        col.accessor("createdAt", {
          header: "Time",
          cell: (c) => (
            <span className="num text-xs text-ink-2" title={formatRelative(c.getValue(), now)}>
              {formatDateTime(c.getValue())}
            </span>
          ),
          meta: { width: 120 },
        }),
        col.accessor("actor", {
          header: "Actor",
          cell: ({ row }) => <ActorBadge name={row.original.actor} kind={row.original.actorKind} />,
          meta: { width: 200 },
        }),
        col.accessor("action", {
          header: "Action",
          cell: (c) => (
            <span
              className={`num text-xs ${c.getValue().startsWith("alert.") ? "text-failed" : c.getValue().startsWith("approval.") || c.getValue().startsWith("killswitch.") ? "font-medium text-ink" : "text-ink"}`}
            >
              {c.getValue()}
            </span>
          ),
          meta: { width: 210 },
        }),
        col.accessor((e) => `${e.targetType}:${e.targetId ?? ""}`, {
          id: "target",
          header: "Target",
          cell: ({ row }) => {
            const e = row.original;
            const base = TARGET_ROUTE[e.targetType];
            const label: ReactNode = (
              <>
                <span className="text-ink-3">{e.targetType}</span>{" "}
                {e.targetId && <span className="num text-xs">{e.targetId}</span>}
              </>
            );
            return base && e.targetId ? (
              <Link to={`${base}${e.targetId}`} className="hover:underline">
                {label}
              </Link>
            ) : (
              <span>{label}</span>
            );
          },
          meta: { width: 220 },
        }),
        col.accessor((e) => describe(e.detail), {
          id: "detail",
          header: "Detail",
          cell: (c) => <span className="text-ink-2">{c.getValue()}</span>,
          enableSorting: false,
        }),
      ]),
    [now],
  );

  return (
    <>
      <PageHeader
        title="Activity"
        subtitle="Every write, with the actor that made it: a display name for humans, the API secret's name for agents."
      />
      <PageBody>
        <Panel
          title="Digest"
          detail={
            digest.data
              ? `${formatDateTime(digest.data.since)} → ${formatDateTime(digest.data.until)}`
              : undefined
          }
          actions={
            <>
              <Tabs
                variant="segmented"
                value={hours}
                onChange={setHours}
                items={[
                  { id: "24", label: "24h" },
                  { id: "72", label: "3d" },
                  { id: "168", label: "7d" },
                ]}
                aria-label="Digest window"
              />
              <Button
                size="xs"
                loading={busy === "send"}
                onClick={() =>
                  perform(
                    "send",
                    () => api.call("digestSend", {}),
                    (r) =>
                      r.delivered
                        ? "Digest sent to the webhook"
                        : {
                            tone: "pending" as const,
                            title: `Digest not delivered${r.detail ? `: ${r.detail}` : ""}`,
                          },
                  )
                }
              >
                Send digest
              </Button>
            </>
          }
        >
          <Loadable state={digest} skeleton={<div className="h-28 animate-pulse rounded-sm bg-surface-3" />}>
            {(d) => (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4 md:grid-cols-[repeat(5,minmax(0,1fr))]">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-ink-3">Spend</span>
                    <Money cents={d.spendCents} className="text-xl font-medium" />
                  </div>
                  <DigestList title="Launched" items={d.launched} />
                  <DigestList title="Killed" items={d.killed} />
                  <DigestList title="Promoted / scaled" items={d.promoted} />
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="flex items-baseline gap-1.5 text-xs text-ink-3">
                      Awaiting approval <Count value={d.pendingApprovals.length} className="text-ink-2" />
                    </span>
                    {d.pendingApprovals.length === 0 ? (
                      <span className="text-sm text-ink-4">None</span>
                    ) : (
                      <ul className="flex flex-col gap-0.5 text-sm">
                        {d.pendingApprovals.slice(0, 5).map((p) => (
                          <li key={p.id} className="flex min-w-0 items-baseline justify-between gap-2">
                            <Link to={`/approvals?id=${p.id}`} className="link truncate">
                              {p.title}
                            </Link>
                            {p.amountCents !== null && <Money cents={p.amountCents} className="text-xs" />}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
                {d.alerts.length > 0 && (
                  <Notice tone="failed" title={`${d.alerts.length} alert${d.alerts.length === 1 ? "" : "s"}`}>
                    <ul className="list-none">
                      {d.alerts.map((a) => (
                        <li key={a}>{a}</li>
                      ))}
                    </ul>
                  </Notice>
                )}
              </div>
            )}
          </Loadable>
        </Panel>

        <Loadable state={activity}>
          {() => (
            <DataTable
              data={rows}
              columns={columns}
              getRowId={(e) => e.id}
              initialSorting={[{ id: "createdAt", desc: true }]}
              columnToggle
              toolbar={
                <Tabs
                  variant="segmented"
                  value={kind}
                  onChange={setKind}
                  items={["all", "human", "agent", "system"].map((k) => ({
                    id: k,
                    label: k === "all" ? "All actors" : k.charAt(0).toUpperCase() + k.slice(1),
                    count: k === "all" ? entries.length : entries.filter((e) => e.actorKind === k).length,
                  }))}
                  aria-label="Filter by actor kind"
                />
              }
              empty={<EmptyState compact title="No activity" />}
            />
          )}
        </Loadable>
        <p className="text-xs text-ink-3">
          Showing the latest <Badge outline>{entries.length}</Badge> entries. Use{" "}
          <span className="num">adlab activity list --limit 500</span> for more.
        </p>
      </PageBody>
    </>
  );
}
