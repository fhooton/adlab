import type { Meta, StoryObj } from "@storybook/react-vite";
import { StatusBadge } from "./Badge";
import { Button } from "./Button";
import { createColumnHelper, DataTable } from "./DataTable";
import { EmptyState } from "./EmptyState";
import { type FixtureRow, ROWS } from "./fixtures";
import { formatMoney, Percent } from "./format";

const meta = { title: "Components/DataTable" } satisfies Meta;
export default meta;

const col = createColumnHelper<FixtureRow>();
const columns = col.columns([
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
]);

/** Sorting, column toggle, totals row, row selection with bulk actions, active row. */
export const Results: StoryObj = {
  render: () => (
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
  ),
};

export const Empty: StoryObj = {
  render: () => (
    <DataTable
      data={[] as FixtureRow[]}
      columns={columns}
      getRowId={(r) => r.id}
      empty={<EmptyState compact title="No rows" description="Empty state inside a table." />}
    />
  ),
};
