import type { Brief, Hypothesis, Test } from "@adlab/contracts";
import {
  buttonClass,
  createColumnHelper,
  DataTable,
  EmptyState,
  formatDateTime,
  formatRelative,
  KeyValue,
  Money,
  PageBody,
  PageHeader,
  Panel,
  Stat,
  StatusBadge,
} from "@adlab/ui";
import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router";
import * as api from "../api";
import { Loadable } from "../common";
import { useNow, usePoll } from "../hooks";

interface BriefRow extends Brief {
  variantCount: number;
  testCount: number;
  running: number;
}

const bcol = createColumnHelper<BriefRow>();

export function BriefsView() {
  const navigate = useNavigate();
  const now = useNow();
  const state = usePoll(async () => {
    const [briefs, variants, tests] = await Promise.all([
      api.run("briefList"),
      api.run("variantsList", {}),
      api.run("testList", {}),
    ]);
    return briefs.map<BriefRow>((b) => ({
      ...b,
      variantCount: variants.filter((v) => v.briefId === b.id).length,
      testCount: tests.filter((t) => t.briefId === b.id).length,
      running: tests.filter((t) => t.briefId === b.id && t.status === "running").length,
    }));
  }, []);

  const columns = useMemo(
    () =>
      bcol.columns([
        bcol.accessor("product", {
          header: "Product",
          cell: ({ row }) => (
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-medium">{row.original.product}</span>
              <span className="truncate text-xs text-ink-3">{row.original.offer}</span>
            </span>
          ),
          meta: { width: "28%" },
        }),
        bcol.accessor("audience", {
          header: "Audience",
          cell: (c) => <span className="text-ink-2">{c.getValue()}</span>,
        }),
        bcol.accessor((b) => b.markets.join(", "), { id: "markets", header: "Markets", meta: { width: 80 } }),
        bcol.accessor((b) => b.platforms.join(", "), {
          id: "platforms",
          header: "Platforms",
          meta: { width: 90, label: "Platforms" },
        }),
        bcol.accessor("conversionEvent", { header: "Event", meta: { width: 90 } }),
        bcol.accessor("variantCount", { header: "Variants", meta: { align: "right", width: 80 } }),
        bcol.accessor("testCount", {
          header: "Tests",
          cell: ({ row }) => (
            <span>
              {row.original.testCount}
              {row.original.running > 0 && (
                <span className="ml-1.5 text-running">{row.original.running} running</span>
              )}
            </span>
          ),
          meta: { align: "right", width: 120 },
        }),
        bcol.accessor("weeklyCapCents", {
          header: "Weekly cap",
          cell: (c) => <Money cents={c.getValue()} whole />,
          meta: { align: "right", width: 100 },
        }),
        bcol.accessor("status", {
          header: "Status",
          cell: (c) => <StatusBadge status={c.getValue()} />,
          meta: { width: 90 },
        }),
        bcol.accessor("createdAt", {
          header: "Created",
          cell: ({ row }) => (
            <span className="text-ink-2" title={formatDateTime(row.original.createdAt)}>
              {formatRelative(row.original.createdAt, now)}
            </span>
          ),
          meta: { width: 110 },
        }),
        bcol.accessor("createdBy", {
          header: "By",
          cell: (c) => <span className="text-ink-2">{c.getValue()}</span>,
          meta: { width: 120 },
        }),
      ]),
    [now],
  );

  return (
    <>
      <PageHeader
        title="Briefs"
        subtitle="What is being marketed, to whom, and the weekly cap each brief may spend."
      />
      <PageBody>
        <Loadable state={state}>
          {(rows) => (
            <DataTable
              data={rows}
              columns={columns}
              getRowId={(r) => r.id}
              initialSorting={[{ id: "createdAt", desc: true }]}
              initialHidden={["platforms"]}
              columnToggle
              onRowClick={(r) => navigate(`/briefs/${r.id}`)}
              toolbar={<span className="num text-xs text-ink-3">{rows.length} briefs</span>}
              empty={
                <EmptyState
                  compact
                  title="No briefs yet"
                  description="An agent creates briefs with `adlab brief create`."
                />
              }
            />
          )}
        </Loadable>
      </PageBody>
    </>
  );
}

const hcol = createColumnHelper<Hypothesis & { variants: number }>();
const tcol = createColumnHelper<Test>();

export function BriefDetailView() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const now = useNow();
  const state = usePoll(async () => {
    const [brief, variants] = await Promise.all([
      api.run("briefGet", { briefId: id }),
      api.run("variantsList", { briefId: id }),
    ]);
    return { brief, variants };
  }, [id]);

  const hypothesisColumns = useMemo(
    () =>
      hcol.columns([
        hcol.accessor("concept", {
          header: "Concept",
          cell: (c) => <span className="font-medium">{c.getValue()}</span>,
          meta: { width: "15%" },
        }),
        hcol.accessor("persona", { header: "Persona", meta: { width: "14%" } }),
        hcol.accessor("format", {
          header: "Format",
          cell: (c) => <span className="text-ink-2">{c.getValue()}</span>,
          meta: { width: "13%" },
        }),
        hcol.accessor("status", {
          header: "Status",
          cell: (c) => <StatusBadge status={c.getValue()} />,
          meta: { width: "11%" },
        }),
        hcol.accessor("rationale", {
          header: "Rationale",
          cell: (c) => <span className="text-ink-2">{c.getValue()}</span>,
          meta: { wrap: true },
        }),
        hcol.accessor("variants", { header: "Variants", meta: { align: "right", width: "8%" } }),
        hcol.accessor((h) => h.decidedBy ?? "", {
          id: "decidedBy",
          header: "Decided by",
          cell: (c) => <span className="text-ink-2">{c.getValue() || "—"}</span>,
          meta: { width: "12%" },
        }),
      ]),
    [],
  );

  const testColumns = useMemo(
    () =>
      tcol.columns([
        tcol.accessor("id", {
          header: "Test",
          cell: (c) => <span className="num text-xs">{c.getValue()}</span>,
          meta: { width: 136 },
        }),
        tcol.accessor("stage", {
          header: "Stage",
          cell: (c) => `Stage ${c.getValue()}`,
          meta: { width: 64 },
        }),
        tcol.accessor("status", {
          header: "Status",
          cell: (c) => <StatusBadge status={c.getValue()} />,
          meta: { width: 96 },
        }),
        tcol.accessor((t) => t.variantIds.length, {
          id: "variants",
          header: "Variants",
          meta: { align: "right", width: 64 },
        }),
        tcol.accessor("budgetCents", {
          header: "Budget",
          cell: (c) => <Money cents={c.getValue()} />,
          meta: { align: "right", width: 84 },
        }),
        tcol.accessor("durationHours", {
          header: "Duration",
          cell: (c) => `${c.getValue()}h`,
          meta: { align: "right", width: 64 },
        }),
        tcol.accessor("ruleVersion", {
          header: "Rules",
          cell: (c) => <span className="num text-xs text-ink-2">{c.getValue()}</span>,
          meta: { width: 88 },
        }),
        tcol.accessor((t) => t.startedAt ?? "", {
          id: "startedAt",
          header: "Started",
          cell: (c) => <span className="text-ink-2">{formatDateTime(c.getValue() || null)}</span>,
        }),
      ]),
    [],
  );

  return (
    <Loadable state={state}>
      {({ brief, variants }) => {
        const hyps = brief.hypotheses.map((h) => ({
          ...h,
          variants: variants.filter((v) => v.hypothesisId === h.id).length,
        }));
        return (
          <>
            <PageHeader
              eyebrow={
                <Link to="/briefs" className="hover:text-ink">
                  Briefs
                </Link>
              }
              title={brief.product}
              badges={<StatusBadge status={brief.status} />}
              subtitle={brief.offer}
              actions={
                <Link to={`/variants?briefId=${brief.id}`} className={buttonClass("secondary", "sm")}>
                  {variants.length} variants
                </Link>
              }
              meta={
                <>
                  <Stat inline label="Weekly cap">
                    <Money cents={brief.weeklyCapCents} />
                  </Stat>
                  <Stat inline label="Event">
                    {brief.conversionEvent}
                  </Stat>
                  <Stat inline label="Markets">
                    {brief.markets.join(", ")}
                  </Stat>
                  <Stat inline label="Languages">
                    {brief.languages.join(", ")}
                  </Stat>
                  <Stat inline label="Platforms">
                    {brief.platforms.join(", ")}
                  </Stat>
                  <Stat inline label="Created">
                    {formatRelative(brief.createdAt, now)} by {brief.createdBy}
                  </Stat>
                </>
              }
            />
            <PageBody>
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
                <div className="flex min-w-0 flex-col gap-6">
                  <DataTable
                    data={hyps}
                    columns={hypothesisColumns}
                    getRowId={(h) => h.id}
                    onRowClick={(h) => navigate(`/variants?briefId=${brief.id}&hypothesisId=${h.id}`)}
                    toolbar={
                      <span className="flex items-baseline gap-2">
                        <span className="text-sm font-semibold">Angle matrix</span>
                        <span className="text-xs text-ink-3">concept × persona × format</span>
                      </span>
                    }
                    empty={
                      <EmptyState
                        compact
                        title="No hypotheses proposed"
                        description="The agent proposes an angle matrix after research; you pick which to test in Approvals."
                      />
                    }
                  />
                  <DataTable
                    data={brief.tests}
                    columns={testColumns}
                    getRowId={(t) => t.id}
                    onRowClick={(t) => navigate(`/tests/${t.id}`)}
                    toolbar={<span className="text-sm font-semibold">Tests</span>}
                    empty={<EmptyState compact title="No tests for this brief yet" />}
                  />
                </div>
                <div className="flex min-w-0 flex-col gap-6">
                  <Panel title="Brief">
                    <KeyValue
                      items={[
                        [
                          "Landing page",
                          <a
                            key="url"
                            href={brief.productUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="link break-all"
                          >
                            {brief.productUrl}
                          </a>,
                        ],
                        ["Audience", brief.audience],
                        ["Offer", brief.offer],
                        ["Notes", brief.notes ?? <span className="text-ink-4">—</span>],
                        [
                          "Id",
                          <span key="id" className="num text-xs">
                            {brief.id}
                          </span>,
                        ],
                      ]}
                    />
                  </Panel>
                  <Panel
                    title="Research"
                    detail={`${brief.research.length} note${brief.research.length === 1 ? "" : "s"}`}
                    padded={false}
                  >
                    {brief.research.length === 0 ? (
                      <EmptyState compact title="No research recorded" />
                    ) : (
                      <div className="divide-y divide-line">
                        {brief.research.map((r) => (
                          <article key={r.id} className="flex flex-col gap-2.5 px-3.5 py-3">
                            <div className="flex items-baseline justify-between gap-2 text-xs text-ink-3">
                              <span>{formatDateTime(r.capturedAt)}</span>
                              <span>{r.createdBy}</span>
                            </div>
                            <p className="text-sm text-ink">{r.summary}</p>
                            <div className="flex flex-col gap-0.5">
                              <span className="text-xs text-ink-3">Sources</span>
                              {r.sources.map((s) => (
                                <a
                                  key={s}
                                  href={s}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="link truncate text-sm"
                                >
                                  {s.replace(/^https?:\/\//, "")}
                                </a>
                              ))}
                            </div>
                            {r.referenceAds.length > 0 && (
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="text-left text-xs text-ink-3">
                                    <th className="pb-1 font-medium">Reference ad</th>
                                    <th className="pb-1 text-right font-medium">Run days</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-line border-t border-line">
                                  {r.referenceAds.map((ad) => (
                                    <tr key={ad.url}>
                                      <td className="py-1.5 pr-2">
                                        <a href={ad.url} target="_blank" rel="noreferrer" className="link">
                                          {ad.advertiser}
                                        </a>
                                        {ad.notes && <div className="text-xs text-ink-3">{ad.notes}</div>}
                                      </td>
                                      <td className="num py-1.5 text-right align-top">{ad.runDays ?? "—"}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </article>
                        ))}
                      </div>
                    )}
                  </Panel>
                </div>
              </div>
            </PageBody>
          </>
        );
      }}
    </Loadable>
  );
}
