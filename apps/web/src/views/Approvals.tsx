import type { Approval, ApprovalKind } from "@adlab/contracts";
import {
  ApprovalPanel,
  Button,
  Checkbox,
  createColumnHelper,
  DataTable,
  EmptyState,
  formatDateTime,
  formatPercent,
  formatRelative,
  humanize,
  Money,
  PageBody,
  PageHeader,
  StatusBadge,
  Tabs,
} from "@adlab/ui";
import { type ReactNode, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import * as api from "../api";
import { ApiError } from "../api";
import { useAuth } from "../auth";
import { Loadable, useBriefs } from "../common";
import { useAction } from "../feedback";
import { useNow, usePoll } from "../hooks";

export const KIND_LABEL: Record<ApprovalKind, string> = {
  launch_test: "Launch test",
  apply_decisions: "Apply decisions",
  select_hypotheses: "Select hypotheses",
};

const FILTERS = ["pending", "approved", "declined", "failed", "expired", "all"] as const;
type Filter = (typeof FILTERS)[number];

const strings = (x: unknown): string[] =>
  Array.isArray(x) ? x.filter((v): v is string => typeof v === "string") : [];
const str = (x: unknown): string | null => (typeof x === "string" ? x : null);

const col = createColumnHelper<Approval>();

/** Pending first (oldest pending at the top: it has waited longest), then newest decided. */
function inboxOrder(a: Approval, b: Approval) {
  if ((a.status === "pending") !== (b.status === "pending")) return a.status === "pending" ? -1 : 1;
  return a.status === "pending"
    ? a.createdAt.localeCompare(b.createdAt)
    : b.createdAt.localeCompare(a.createdAt);
}

export function ApprovalsView() {
  const [params, setParams] = useSearchParams();
  const filter = (params.get("status") as Filter | null) ?? "pending";
  const selectedId = params.get("id");
  const now = useNow();
  const { me } = useAuth();
  const { busy, perform } = useAction();
  const state = usePoll(() => api.run("approvalList", {}), []);
  const [selections, setSelections] = useState<Record<string, string[]>>({});

  const all = state.data ?? [];
  const rows = useMemo(
    () => (filter === "all" ? all : all.filter((a) => a.status === filter)).slice().sort(inboxOrder),
    [all, filter],
  );
  const current = all.find((a) => a.id === selectedId) ?? rows[0] ?? null;
  const count = (s: Filter) => (s === "all" ? all.length : all.filter((a) => a.status === s).length);

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const decide = (a: Approval, decision: "approve" | "decline", note: string) => {
    const selection =
      a.kind === "select_hypotheses" && decision === "approve" ? (selections[a.id] ?? []) : undefined;
    return perform(
      decision,
      () =>
        api.call("approvalDecide", {
          approvalId: a.id,
          version: a.version,
          decision,
          selection,
          note: note.trim() || undefined,
        }),
      (res) => `${decision === "approve" ? "Approved" : "Declined"}: ${res.resultMessage ?? a.title}`,
    );
  };

  const bulkApprove = (ids: string[], clear: () => void) =>
    perform(
      "bulk",
      async () => {
        let ok = 0;
        let conflicts = 0;
        const errors: string[] = [];
        for (const id of ids) {
          const a = all.find((x) => x.id === id);
          if (a?.status !== "pending") continue;
          try {
            await api.call("approvalDecide", { approvalId: a.id, version: a.version, decision: "approve" });
            ok++;
          } catch (err) {
            if (err instanceof ApiError && err.isConflict) conflicts++;
            else errors.push(err instanceof Error ? err.message : String(err));
          }
        }
        clear();
        if (errors.length)
          throw new ApiError(500, "bulk", `Approved ${ok}; ${errors.length} failed: ${errors[0]}`);
        return { status: 200, body: { ok, conflicts } };
      },
      (b) =>
        `Approved ${b.ok} decision set${b.ok === 1 ? "" : "s"}${b.conflicts ? ` · ${b.conflicts} already decided by someone else` : ""}`,
    );

  const columns = useMemo(
    () =>
      col.columns([
        col.accessor("kind", {
          header: "Kind",
          cell: (c) => <span className="text-xs text-ink-2">{KIND_LABEL[c.getValue()]}</span>,
          meta: { width: 112 },
        }),
        col.accessor("title", {
          header: "Request",
          cell: ({ row }) => (
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-medium">{row.original.title}</span>
              <span className="truncate text-xs text-ink-3">
                {row.original.summary.split("\n")[0]?.replace(/^\s*•\s*/, "")}
              </span>
            </span>
          ),
        }),
        col.accessor("requestedBy", {
          header: "Requested by",
          cell: (c) => <span className="text-ink-2">{c.getValue()}</span>,
          meta: { width: 112 },
        }),
        col.accessor("amountCents", {
          header: "Amount",
          cell: (c) => <Money cents={c.getValue()} />,
          meta: { align: "right", width: 80 },
        }),
        col.accessor("createdAt", {
          header: "Age",
          cell: (c) => (
            <span className="text-ink-2" title={formatDateTime(c.getValue())}>
              {formatRelative(c.getValue(), now)}
            </span>
          ),
          meta: { width: 104 },
        }),
        col.accessor("status", {
          header: "Status",
          cell: (c) => <StatusBadge status={c.getValue()} />,
          meta: { width: 96 },
        }),
      ]),
    [now],
  );

  const bulkCandidates = rows.filter((a) => a.status === "pending" && a.kind === "apply_decisions");

  return (
    <>
      <PageHeader
        title="Approvals"
        subtitle="Agents request spend and decisions; only a dashboard session can approve them. Your display name is recorded on every decision."
        meta={
          me && (
            <span className="text-xs text-ink-3">
              Deciding as <span className="font-medium text-ink-2">{me.name}</span>
            </span>
          )
        }
      />
      <PageBody>
        <Tabs
          variant="segmented"
          value={filter}
          onChange={(f) => {
            const next = new URLSearchParams(params);
            next.set("status", f);
            next.delete("id");
            setParams(next, { replace: true });
          }}
          items={FILTERS.map((f) => ({ id: f, label: humanize(f), count: count(f) }))}
          aria-label="Filter approvals by status"
        />
        <Loadable state={state}>
          {() => (
            <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
              <DataTable
                data={rows}
                columns={columns}
                getRowId={(a) => a.id}
                activeRowId={current?.id ?? null}
                onRowClick={(a) => setParam("id", a.id)}
                selectable={
                  bulkCandidates.length > 1
                    ? (a) => a.status === "pending" && a.kind === "apply_decisions"
                    : false
                }
                bulkActions={(ids, clear) => (
                  <Button
                    variant="primary"
                    size="xs"
                    loading={busy === "bulk"}
                    disabled={busy !== null}
                    onClick={() => bulkApprove(ids, clear)}
                  >
                    Approve {ids.length} decision set{ids.length === 1 ? "" : "s"}
                  </Button>
                )}
                toolbar={
                  <span className="text-xs text-ink-3">
                    {bulkCandidates.length > 1
                      ? `Select decision sets to approve them together · ${bulkCandidates.length} eligible`
                      : `${rows.length} ${filter === "all" ? "" : filter} approval${rows.length === 1 ? "" : "s"}`}
                  </span>
                }
                empty={
                  <EmptyState
                    compact
                    title={filter === "pending" ? "Inbox clear" : `No ${filter} approvals`}
                    description={
                      filter === "pending"
                        ? "Nothing is waiting on a human right now. New requests appear here within seconds."
                        : undefined
                    }
                  />
                }
              />
              <div className="xl:sticky xl:top-4">
                {current ? (
                  <ApprovalPanel
                    key={current.id}
                    className="max-h-[calc(100dvh-2rem)]"
                    title={current.title}
                    kindLabel={KIND_LABEL[current.kind]}
                    status={current.status}
                    requester={current.requestedBy}
                    requestedAt={current.createdAt}
                    amountCents={current.amountCents}
                    summary={current.kind === "select_hypotheses" ? "" : current.summary}
                    details={detailsFor(current)}
                    submitting={busy === "approve" || busy === "decline" ? busy : null}
                    onApprove={(note) => decide(current, "approve", note)}
                    onDecline={(note) => decide(current, "decline", note)}
                    approveDisabled={
                      current.kind === "select_hypotheses" && !(selections[current.id]?.length ?? 0)
                    }
                    approveHint="Pick at least one hypothesis to test"
                    approveLabel={
                      current.kind === "launch_test"
                        ? "Approve launch"
                        : current.kind === "select_hypotheses"
                          ? `Approve ${selections[current.id]?.length ?? 0} selected`
                          : `Apply ${strings(current.payload.decisionIds).length || ""} decision${strings(current.payload.decisionIds).length === 1 ? "" : "s"}`
                    }
                    decision={{ by: current.decidedBy, at: current.decidedAt, result: current.resultMessage }}
                  >
                    <ApprovalContext
                      approval={current}
                      selection={selections[current.id] ?? []}
                      onSelection={(ids) => setSelections((s) => ({ ...s, [current.id]: ids }))}
                    />
                  </ApprovalPanel>
                ) : (
                  <div className="rounded-md border border-dashed border-line-strong">
                    <EmptyState
                      compact
                      title="Select an approval"
                      description="Details, amount and the approve / decline controls appear here."
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </Loadable>
      </PageBody>
    </>
  );
}

function detailsFor(a: Approval): Array<[string, ReactNode]> {
  const testId = str(a.payload.testId);
  const out: Array<[string, ReactNode]> = [];
  if (testId)
    out.push([
      "Test",
      <Link key="t" to={`/tests/${testId}`} className="link num text-xs">
        {testId}
      </Link>,
    ]);
  const briefId = str(a.payload.briefId);
  if (briefId)
    out.push([
      "Brief",
      <Link key="b" to={`/briefs/${briefId}`} className="link num text-xs">
        {briefId}
      </Link>,
    ]);
  out.push(["Approval", <span key="a" className="num text-xs">{`${a.id} · v${a.version}`}</span>]);
  return out;
}

/** Kind-specific context: hypothesis picker, affected variants, or the test being launched. */
function ApprovalContext({
  approval,
  selection,
  onSelection,
}: {
  approval: Approval;
  selection: string[];
  onSelection: (ids: string[]) => void;
}) {
  if (approval.kind === "select_hypotheses")
    return <HypothesisPicker approval={approval} selection={selection} onSelection={onSelection} />;
  const testId = str(approval.payload.testId);
  if (!testId) return null;
  return <TestContext approval={approval} testId={testId} />;
}

function HypothesisPicker({
  approval,
  selection,
  onSelection,
}: {
  approval: Approval;
  selection: string[];
  onSelection: (ids: string[]) => void;
}) {
  const briefId = str(approval.payload.briefId) ?? "";
  const ids = strings(approval.payload.hypothesisIds);
  const state = usePoll(() => api.run("briefGet", { briefId }), [briefId]);
  const pending = approval.status === "pending";
  const hyps = (state.data?.hypotheses ?? []).filter((h) => ids.includes(h.id));
  const toggle = (id: string) =>
    onSelection(selection.includes(id) ? selection.filter((x) => x !== id) : [...selection, id]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium text-ink-2">
          {pending ? "Pick the angles worth testing" : "Angles"} · {ids.length} proposed
        </span>
        {pending && hyps.length > 0 && (
          <span className="flex gap-2 text-xs">
            <button
              type="button"
              className="text-ink-3 hover:text-ink"
              onClick={() => onSelection(hyps.map((h) => h.id))}
            >
              All
            </button>
            <button type="button" className="text-ink-3 hover:text-ink" onClick={() => onSelection([])}>
              None
            </button>
          </span>
        )}
      </div>
      {state.data === undefined ? (
        <div className="h-24 animate-pulse rounded-sm bg-surface-3" />
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-sm border border-line">
          {hyps.map((h) => (
            <li key={h.id}>
              <label
                htmlFor={`hyp-${h.id}`}
                className={`flex gap-2.5 px-2.5 py-2 ${pending ? "cursor-pointer hover:bg-surface-2" : ""}`}
              >
                {pending ? (
                  <Checkbox
                    id={`hyp-${h.id}`}
                    checked={selection.includes(h.id)}
                    onChange={() => toggle(h.id)}
                    className="mt-0.5"
                  />
                ) : (
                  <StatusBadge status={h.status} />
                )}
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm font-medium text-ink">
                    {h.concept} <span className="font-normal text-ink-3">×</span> {h.persona}{" "}
                    <span className="font-normal text-ink-3">×</span> {h.format}
                  </span>
                  <span className="text-xs text-ink-2">{h.rationale}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TestContext({ approval, testId }: { approval: Approval; testId: string }) {
  const state = usePoll(() => api.run("testGet", { testId }), [testId]);
  const briefs = useBriefs();
  const decisionIds = strings(approval.payload.decisionIds);
  return (
    <Loadable state={state} skeleton={<div className="h-24 animate-pulse rounded-sm bg-surface-3" />}>
      {(r) => {
        if (approval.kind === "launch_test") {
          return (
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-line bg-line text-sm">
              {(
                [
                  ["Brief", briefs.name(r.test.briefId)],
                  ["Stage", `Stage ${r.test.stage} · ${r.test.platform}`],
                  ["Variants", String(r.test.variantIds.length)],
                  ["Duration", `${r.test.durationHours}h`],
                  ["Rules", r.test.ruleVersion],
                  ["Status", humanize(r.test.status)],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="flex flex-col bg-surface px-2.5 py-1.5">
                  <span className="text-xs text-ink-3">{k}</span>
                  <span className="truncate text-ink">{v}</span>
                </div>
              ))}
            </div>
          );
        }
        const affected = r.variants.filter(
          (v) => v.latestDecision && decisionIds.includes(v.latestDecision.id),
        );
        if (!affected.length) return null;
        return (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-ink-2">Evidence for these decisions</span>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-xs text-ink-3">
                  <th className="py-1 text-left font-medium">Variant</th>
                  <th className="py-1 text-left font-medium">Action</th>
                  <th className="py-1 text-right font-medium">Hook</th>
                  <th className="py-1 text-right font-medium">P(best)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {affected.map((v) => (
                  <tr key={v.variantId}>
                    <td className="max-w-0 truncate py-1.5 pr-2">{v.label}</td>
                    <td className="py-1.5">
                      {v.latestDecision && (
                        <StatusBadge
                          status={v.latestDecision.action}
                          label={v.latestDecision.action.toUpperCase()}
                        />
                      )}
                    </td>
                    <td className="num py-1.5 text-right">{formatPercent(v.rates.hookRate)}</td>
                    <td className="num py-1.5 text-right">{formatPercent(v.probBest, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }}
    </Loadable>
  );
}
