import {
  ApprovalPanel,
  Badge,
  Button,
  Checkbox,
  ConfidenceBar,
  createColumnHelper,
  DataTable,
  Dialog,
  EmptyState,
  Field,
  formatMoney,
  formatPercent,
  Input,
  KeyValue,
  KillSwitch,
  Menu,
  Meter,
  MetricCard,
  MetricGrid,
  Money,
  Notice,
  PageBody,
  PageHeader,
  Panel,
  Percent,
  Rating,
  SectionTitle,
  Select,
  Sparkline,
  Spinner,
  Stat,
  StatusBadge,
  Tabs,
  TextArea,
  type Tone,
  VariantCard,
} from "@adlab/ui";
import { type ReactNode, useMemo, useState } from "react";

/**
 * Visual reference: every @adlab/ui component in each of its states, on fixture data.
 * Agents changing the UI should check this page first and keep it complete.
 */

const TONES: Tone[] = ["running", "pending", "killed", "won", "failed", "nmd", "neutral"];
const STATUSES = [
  "running",
  "pending_approval",
  "paused",
  "killed",
  "won",
  "approved",
  "failed",
  "render_failed",
  "draft",
  "ended",
  "need_more_data",
];

interface FixtureRow {
  id: string;
  label: string;
  impressions: number;
  spendCents: number;
  hookRate: number | null;
  status: string;
}
const ROWS: FixtureRow[] = [
  { id: "a", label: "control", impressions: 12840, spendCents: 4012, hookRate: 0.256, status: "live" },
  {
    id: "b",
    label: "hook: Kids actually eat the veggies",
    impressions: 13102,
    spendCents: 4100,
    hookRate: 0.291,
    status: "won",
  },
  {
    id: "c",
    label: "hook: Skip the grocery run.",
    impressions: 11977,
    spendCents: 3875,
    hookRate: 0.205,
    status: "killed",
  },
  {
    id: "d",
    label: "hook: Takeout is costing you.",
    impressions: 0,
    spendCents: 0,
    hookRate: null,
    status: "draft",
  },
];
const col = createColumnHelper<FixtureRow>();

function Swatch({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="size-6 rounded-sm border border-line" style={{ background: `var(--color-${name})` }} />
      <span className="num text-xs text-ink-2">{name}</span>
    </div>
  );
}

function Section({ title, children, detail }: { title: string; children: ReactNode; detail?: string }) {
  return (
    <section className="flex flex-col gap-3">
      <SectionTitle detail={detail}>{title}</SectionTitle>
      {children}
    </section>
  );
}

function PosterFixture({ hue, text }: { hue: number; text: string }) {
  return (
    <svg viewBox="0 0 90 160" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="90" height="160" fill={`hsl(${hue} 30% 22%)`} />
      <text x="8" y="70" fill="white" fontSize="11" fontFamily="Inter Variable, sans-serif" fontWeight="700">
        {text}
      </text>
      <rect x="8" y="132" width="50" height="12" rx="2" fill="white" opacity="0.9" />
    </svg>
  );
}

export function KitchenSinkView() {
  const [dialog, setDialog] = useState(false);
  const [tab, setTab] = useState("one");
  const [seg, setSeg] = useState("all");
  const [rating, setRating] = useState<number | null>(3);
  const [engaged, setEngaged] = useState(false);
  const [visible, setVisible] = useState(["a", "b"]);
  const [picked, setPicked] = useState<string[]>(["h1"]);
  const scale = { min: 0.15, max: 0.35 };

  const columns = useMemo(
    () =>
      col.columns([
        col.accessor("label", { header: "Variant", footer: () => "Total", meta: { label: "Variant" } }),
        col.accessor("impressions", {
          header: "Impr.",
          cell: (c) => c.getValue().toLocaleString(),
          footer: () => ROWS.reduce((s, r) => s + r.impressions, 0).toLocaleString(),
          meta: { align: "right", width: 90 },
        }),
        col.accessor("spendCents", {
          header: "Spend",
          cell: (c) => formatMoney(c.getValue()),
          footer: () => formatMoney(ROWS.reduce((s, r) => s + r.spendCents, 0)),
          meta: { align: "right", width: 90 },
        }),
        col.accessor("hookRate", {
          header: "Hook",
          cell: (c) => <Percent value={c.getValue()} />,
          meta: { align: "right", width: 70 },
        }),
        col.accessor("status", {
          header: "Status",
          cell: (c) => <StatusBadge status={c.getValue()} />,
          meta: { width: 100 },
        }),
      ]),
    [],
  );

  return (
    <>
      <PageHeader
        title="Kitchen sink"
        subtitle="Every @adlab/ui component in each state, on fixture data. The visual reference for humans and agents."
      />
      <PageBody className="gap-10">
        <Section title="Tokens" detail="packages/ui/src/tokens.css — status colour is defined once">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
            {[
              "canvas",
              "surface",
              "surface-2",
              "surface-3",
              "line",
              "line-strong",
              "ink",
              "ink-2",
              "ink-3",
              "ink-4",
              "accent",
              "focus",
              "link",
              "danger",
            ].map((c) => (
              <Swatch key={c} name={c} />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
            {TONES.map((t) => (
              <div key={t} className="flex flex-col gap-1.5">
                <Swatch name={t} />
                <Swatch name={`${t}-bg`} />
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-baseline gap-6">
            <span className="text-2xl font-semibold">24 / Title</span>
            <span className="text-xl font-semibold">20 / Page</span>
            <span className="text-md font-semibold">14 / Panel</span>
            <span className="text-base">13 / Body</span>
            <span className="text-sm text-ink-2">12 / Secondary</span>
            <span className="text-xs text-ink-3">11 / Label</span>
            <span className="num text-base">1,234,567.89 tabular</span>
          </div>
        </Section>

        <Section title="Button">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary">Primary</Button>
            <Button>Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button variant="primary" loading>
              Loading
            </Button>
            <Button disabled>Disabled</Button>
            <Button size="xs">Extra small</Button>
            <Button size="md" variant="primary">
              Medium
            </Button>
            <Spinner />
          </div>
        </Section>

        <Section title="Badge / StatusBadge">
          <div className="flex flex-wrap gap-2">
            {TONES.map((t) => (
              <Badge key={t} tone={t} dot>
                {t}
              </Badge>
            ))}
            <Badge outline>outline tag</Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            {STATUSES.map((s) => (
              <StatusBadge key={s} status={s} />
            ))}
          </div>
        </Section>

        <Section title="Formatters / Stat">
          <div className="flex flex-wrap gap-8">
            <Stat label="Money">
              <Money cents={2400050} />
            </Stat>
            <Stat label="Money (whole)">
              <Money cents={2400050} whole />
            </Stat>
            <Stat label="Money (null)">
              <Money cents={null} />
            </Stat>
            <Stat label="Percent">
              <Percent value={0.2913} />
            </Stat>
            <Stat label="Percent (null)">
              <Percent value={null} />
            </Stat>
            <Stat inline label="Inline stat">
              <Money cents={24000} />
            </Stat>
          </div>
        </Section>

        <Section title="MetricCard / Sparkline / Meter">
          <MetricGrid columns={5}>
            <MetricCard
              label="Spend"
              value={<Money cents={7926} />}
              delta="+12%"
              deltaTone="up"
              hint="vs yesterday"
              sparkline={[2, 3, 3, 5, 4, 6, 8]}
            />
            <MetricCard label="Pending approvals" value="3" tone="pending" hint="Needs a human" />
            <MetricCard label="Winners" value="1" tone="won" />
            <MetricCard label="Failed renders" value="2" tone="failed" delta="+2" deltaTone="down" />
            <MetricCard
              label="Cost / winner"
              value={<Money cents={null} />}
              hint="No winners yet"
              onClick={() => {}}
            />
          </MetricGrid>
          <div className="grid gap-6 md:grid-cols-3">
            <Meter value={12000} committed={24000} max={50000} label="Under cap" valueLabel="$120 of $500" />
            <Meter
              value={30000}
              committed={42000}
              max={50000}
              label="Near cap (amber)"
              valueLabel="84% committed"
            />
            <Meter value={52000} max={50000} label="Over cap (red)" valueLabel="104%" />
          </div>
          <div className="flex items-center gap-6">
            <Sparkline values={[1, 4, 2, 6, 3, 7, 9, 5]} />
            <Sparkline values={[5]} />
            <Sparkline values={[3, 2, 4, 1]} color="var(--color-won)" area={false} />
          </div>
        </Section>

        <Section title="ConfidenceBar" detail="shared scale across rows; explicit need-more-data state">
          <div className="flex flex-col gap-2 rounded-md border border-line bg-surface p-3">
            <ConfidenceBar
              interval={{ low: 0.24, mean: 0.256, high: 0.272 }}
              scale={scale}
              enoughEvidence
              tone="control"
            />
            <ConfidenceBar
              interval={{ low: 0.276, mean: 0.291, high: 0.306 }}
              scale={scale}
              enoughEvidence
              tone="won"
              reference={0.256}
            />
            <ConfidenceBar
              interval={{ low: 0.19, mean: 0.205, high: 0.221 }}
              scale={scale}
              enoughEvidence
              tone="killed"
              reference={0.256}
            />
            <ConfidenceBar
              interval={{ low: 0.18, mean: 0.26, high: 0.33 }}
              scale={scale}
              enoughEvidence={false}
            />
            <ConfidenceBar interval={null} scale={scale} enoughEvidence={false} />
          </div>
        </Section>

        <Section
          title="DataTable"
          detail="sorting, column toggle, totals row, selection + bulk actions, empty"
        >
          <DataTable
            data={ROWS}
            columns={columns}
            getRowId={(r) => r.id}
            totals
            columnToggle
            selectable={(r) => r.status !== "draft"}
            bulkActions={(ids, clear) => (
              <Button size="xs" variant="primary" onClick={clear}>
                Approve {ids.length}
              </Button>
            )}
            toolbar={<span className="text-sm font-semibold">Fixture results</span>}
            initialSorting={[{ id: "hookRate", desc: true }]}
            activeRowId="b"
          />
          <DataTable
            data={[] as FixtureRow[]}
            columns={columns}
            getRowId={(r) => r.id}
            empty={<EmptyState compact title="No rows" description="Empty state inside a table." />}
          />
        </Section>

        <Section title="VariantCard / Rating">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(172px,1fr))] gap-3">
            <VariantCard
              media={<PosterFixture hue={150} text="Dinner in 30." />}
              label="control"
              sublabel="Dinner in 30 minutes. Really."
              status="live"
              rating={4.5}
              isControl
              tags={["Bold claim", "Motion graphic"]}
              mediaBadge="0:10"
              meta="bold-claim-10s · 23c4240e"
              onClick={() => {}}
            />
            <VariantCard
              media={<PosterFixture hue={30} text="Kids eat veg." />}
              label="hook: Kids actually eat"
              sublabel="Kids actually eat the veggies."
              status="won"
              rating={3}
              tags={["Bold claim"]}
              selected
              onClick={() => {}}
            />
            <VariantCard
              media={<PosterFixture hue={0} text="Skip it." />}
              label="hook: Skip the grocery run."
              status="killed"
              rating={null}
              tags={["Bold claim"]}
            />
            <VariantCard
              media={<div className="flex items-center justify-center text-xs text-ink-3">Rendering…</div>}
              label="hook: Cook once."
              status="rendering"
              rating={null}
            />
            <VariantCard
              media={
                <div className="flex items-center justify-center text-xs text-failed">Render failed</div>
              }
              label="hook: Takeout"
              status="render_failed"
              rating={null}
              aspect="1:1"
            />
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <Rating value={rating} onChange={setRating} size="md" />
            <Rating value={null} onChange={() => {}} size="md" disabled />
            <Rating value={3.6} />
            <Rating value={null} />
          </div>
          <p className="text-xs text-ink-3">
            VariantPlayer (the hyperframes-player wrapper) is exercised live on every variant page.
          </p>
        </Section>

        <Section title="ApprovalPanel">
          <div className="grid gap-4 xl:grid-cols-3">
            <ApprovalPanel
              title="Launch stage 1 test: 6 variants for Sprout"
              kindLabel="Launch test"
              status="pending"
              requester="claude-agent"
              requestedAt={new Date(Date.now() - 12 * 60_000).toISOString()}
              amountCents={24000}
              summary="ABO: 1 campaign, 1 ad set per variant. Lifetime budget $240.00 over 72h. After approval: brief week committed $240.00 of $400.00."
              details={[["Test", "tst_gyuy5j6zsz6h"]]}
              onApprove={() => {}}
              onDecline={() => {}}
              approveLabel="Approve launch"
            />
            <ApprovalPanel
              title="Pick angles to test for Sprout"
              kindLabel="Select hypotheses"
              status="pending"
              requester="claude-agent"
              requestedAt={new Date(Date.now() - 3 * 3_600_000).toISOString()}
              summary=""
              approveDisabled={picked.length === 0}
              approveHint="Pick at least one hypothesis to test"
              approveLabel={`Approve ${picked.length} selected`}
              onApprove={() => {}}
              onDecline={() => {}}
              submitting="approve"
            >
              <ul className="flex flex-col divide-y divide-line rounded-sm border border-line">
                {[
                  ["h1", "time-saved × busy-parent × motion_graphic"],
                  ["h2", "picky-eaters × busy-parent × motion_graphic"],
                ].map(([id, label]) => (
                  <li key={id}>
                    <label
                      htmlFor={`ks-${id}`}
                      className="flex cursor-pointer items-center gap-2.5 px-2.5 py-2 text-sm"
                    >
                      <Checkbox
                        id={`ks-${id}`}
                        checked={picked.includes(id ?? "")}
                        onChange={() =>
                          setPicked((p) =>
                            p.includes(id ?? "") ? p.filter((x) => x !== id) : [...p, id ?? ""],
                          )
                        }
                      />
                      {label}
                    </label>
                  </li>
                ))}
              </ul>
            </ApprovalPanel>
            <ApprovalPanel
              title="3 decision(s) on stage 1 test"
              kindLabel="Apply decisions"
              status="approved"
              requester="rules:stage1-v1"
              requestedAt={new Date(Date.now() - 26 * 3_600_000).toISOString()}
              summary={
                "• KILL hook: Skip the grocery run.: hook rate below control\n• PROMOTE hook: Kids actually eat: P(best) 91%"
              }
              decision={{
                by: "Forrest",
                at: new Date().toISOString(),
                result: "Applied 3 decision(s) — looks right",
              }}
            />
          </div>
        </Section>

        <Section title="KillSwitch / Dialog / Menu / Tabs">
          <div className="grid gap-6 md:grid-cols-3">
            <div className="flex w-[216px] flex-col gap-2">
              <KillSwitch
                engaged={engaged}
                onEngage={() => setEngaged(true)}
                onRelease={() => setEngaged(false)}
              />
              <span className="text-xs text-ink-3">Click to engage (fixture; no API call).</span>
            </div>
            <div className="flex w-[216px] flex-col gap-2">
              <KillSwitch engaged onEngage={() => {}} />
              <span className="text-xs text-ink-3">Engaged, as an agent sees it (no release).</span>
            </div>
            <div className="flex flex-wrap items-start gap-2">
              <Button onClick={() => setDialog(true)}>Open dialog</Button>
              <Menu
                label="Actions"
                items={[
                  { id: "a", label: "Re-run decide" },
                  { id: "b", label: "Sync now", detail: "5s" },
                  { id: "c", label: "Archive brief", danger: true, separatorBefore: true },
                ]}
                onAction={() => {}}
              />
              <Menu
                label="Columns"
                variant="ghost"
                items={[
                  { id: "a", label: "Impressions" },
                  { id: "b", label: "Spend" },
                  { id: "c", label: "CTR" },
                ]}
                selectedIds={visible}
                onSelectionChange={setVisible}
              />
            </div>
          </div>
          <Tabs
            value={tab}
            onChange={setTab}
            items={[
              { id: "one", label: "Results", count: 6 },
              { id: "two", label: "Decisions", count: 3 },
              { id: "three", label: "Pre-flight" },
            ]}
          />
          <Tabs
            variant="segmented"
            value={seg}
            onChange={setSeg}
            items={[
              { id: "all", label: "All", count: 12 },
              { id: "pending", label: "Pending", count: 3 },
              { id: "approved", label: "Approved" },
            ]}
          />
          <Dialog
            isOpen={dialog}
            onOpenChange={setDialog}
            title="Dialog title"
            description="One line of context about what happens next."
            actions={
              <>
                <Button variant="ghost" onClick={() => setDialog(false)}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={() => setDialog(false)}>
                  Confirm
                </Button>
              </>
            }
          >
            <p className="text-sm text-ink-2">Body content.</p>
          </Dialog>
        </Section>

        <Section title="Field / Notice / EmptyState / Panel">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="flex flex-col gap-3">
              <Field label="Display name" hint="Shown in the audit log.">
                {(id) => <Input id={id} placeholder="Forrest" />}
              </Field>
              <Field label="Reason" error="At least 3 characters">
                {(id) => <TextArea id={id} defaultValue="no" />}
              </Field>
              <div className="flex items-center gap-3">
                <Select defaultValue="b">
                  <option value="a">All briefs</option>
                  <option value="b">Sprout</option>
                </Select>
                <label htmlFor="ks-checked" className="flex items-center gap-1.5 text-sm">
                  <Checkbox id="ks-checked" defaultChecked /> Checked
                </label>
                <label htmlFor="ks-indeterminate" className="flex items-center gap-1.5 text-sm">
                  <Checkbox id="ks-indeterminate" indeterminate /> Indeterminate
                </label>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Notice tone="pending" title="Changed since you loaded it — refreshing">
                Someone else approved this first.
              </Notice>
              <Notice tone="failed" title="Launch blocked">
                Weekly cap would be exceeded by {formatMoney(4000)}.
              </Notice>
              <Notice tone="won" title="Applied 3 decisions" />
              <Notice tone="nmd" title="Need more data">
                {formatPercent(0.42, 0)} of the minimum impressions so far.
              </Notice>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Panel title="Panel" detail="with detail" actions={<Button size="xs">Action</Button>}>
              <KeyValue
                items={[
                  ["Key", "Value"],
                  [
                    "Spec hash",
                    <span key="h" className="num text-xs">
                      23c4240e4536fd2e
                    </span>,
                  ],
                ]}
              />
            </Panel>
            <Panel title="Empty panel" padded={false}>
              <EmptyState
                compact
                title="Nothing here yet"
                description="What is missing and what to do about it."
                action={<Button size="xs">Do the thing</Button>}
              />
            </Panel>
          </div>
        </Section>
      </PageBody>
    </>
  );
}
