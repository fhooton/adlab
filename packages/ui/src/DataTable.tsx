import {
  type ColumnDef,
  columnVisibilityFeature,
  createSortedRowModel,
  metaHelper,
  type Row,
  type RowData,
  type RowSelectionState,
  rowSelectionFeature,
  rowSortingFeature,
  type SortingState,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
  createColumnHelper as tanstackColumnHelper,
  useTable,
  type ColumnVisibilityState as VisibilityState,
} from "@tanstack/react-table";
import { type ReactNode, useMemo, useState } from "react";
import { cx } from "./cx";
import { EmptyState } from "./EmptyState";
import { Checkbox } from "./Field";
import { Menu } from "./Menu";

/** Per-column presentation hints, set via `meta` on a column definition. */
export interface DataTableColumnMeta {
  /** Right-align numbers (also switches to tabular mono). */
  align?: "left" | "right" | "center";
  /** Name shown in the column visibility menu (defaults to the header string or id). */
  label?: string;
  /** Fixed width, e.g. 120 or "30%". */
  width?: number | string;
  /** Extra classes for body cells. */
  className?: string;
  /** Allow text to wrap instead of truncating (default: truncate). */
  wrap?: boolean;
}

/** The feature set every DataTable registers. Column helpers are typed against it. */
export const dataTableFeatures = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    basic: sortFn_basic,
    datetime: sortFn_datetime,
    text: sortFn_text,
  },
  columnVisibilityFeature,
  rowSelectionFeature,
  columnMeta: metaHelper<DataTableColumnMeta>(),
});
export type DataTableFeatures = typeof dataTableFeatures;
// biome-ignore lint/suspicious/noExplicitAny: column value types vary per column
export type DataTableColumn<T extends RowData> = ColumnDef<DataTableFeatures, T, any>;
export type { RowData, SortingState, VisibilityState };

/**
 * Typed column helper for DataTable. Define columns at module scope or in useMemo:
 *   const col = createColumnHelper<Row>();
 *   const columns = col.columns([col.accessor("spend", { header: "Spend", meta: { align: "right" } })]);
 */
export function createColumnHelper<T extends RowData>() {
  return tanstackColumnHelper<DataTableFeatures, T>();
}

export interface DataTableProps<T extends RowData> {
  data: T[];
  columns: DataTableColumn<T>[];
  /** Stable row id (used for selection and React keys). */
  getRowId: (row: T) => string;
  /** Initial sort, e.g. [{ id: "spend", desc: true }]. Headers toggle sorting on click. */
  initialSorting?: SortingState;
  /** Columns hidden initially, by id. Users toggle them from the "Columns" menu. */
  initialHidden?: string[];
  /** Show the column visibility menu in the toolbar. */
  columnToggle?: boolean;
  /** Enable row checkboxes. Pass a predicate to make only some rows selectable. */
  selectable?: boolean | ((row: T) => boolean);
  /** Rendered in the toolbar while rows are selected: receives selected ids and a clear() function. */
  bulkActions?: (selectedIds: string[], clear: () => void) => ReactNode;
  /** Render a totals row from each column's `footer`. */
  totals?: boolean;
  /** Left side of the toolbar (title, filters). */
  toolbar?: ReactNode;
  /** Shown when `data` is empty. */
  empty?: ReactNode;
  onRowClick?: (row: T) => void;
  /** Highlight a row (e.g. the one open in a side panel). */
  activeRowId?: string | null;
  rowClassName?: (row: T) => string | undefined;
  /** Drop the outer border/radius when nested in a Panel. */
  bare?: boolean;
  className?: string;
}

const alignClass = { left: "text-left", right: "text-right", center: "text-center" } as const;

function columnLabel(col: {
  id: string;
  columnDef: { header?: unknown; meta?: DataTableColumnMeta };
}): string {
  return (
    col.columnDef.meta?.label ?? (typeof col.columnDef.header === "string" ? col.columnDef.header : col.id)
  );
}

/**
 * Dense, numbers-first table (TanStack Table v9, headless). Sorting, column visibility,
 * optional totals row, row selection with bulk actions, and an empty state.
 */
export function DataTable<T extends RowData>({
  data,
  columns,
  getRowId,
  initialSorting = [],
  initialHidden = [],
  columnToggle,
  selectable,
  bulkActions,
  totals,
  toolbar,
  empty,
  onRowClick,
  activeRowId,
  rowClassName,
  bare,
  className,
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>(initialSorting);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() =>
    Object.fromEntries(initialHidden.map((id) => [id, false])),
  );
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const allColumns = useMemo<DataTableColumn<T>[]>(() => {
    if (!selectable) return columns;
    const select: DataTableColumn<T> = {
      id: "__select",
      enableSorting: false,
      enableHiding: false,
      meta: { width: 32 },
      header: ({ table }) => (
        <Checkbox
          aria-label="Select all rows"
          checked={table.getIsAllRowsSelected()}
          indeterminate={table.getIsSomeRowsSelected() && !table.getIsAllRowsSelected()}
          onChange={table.getToggleAllRowsSelectedHandler()}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          aria-label="Select row"
          checked={row.getIsSelected()}
          disabled={!row.getCanSelect()}
          onClick={(e) => e.stopPropagation()}
          onChange={row.getToggleSelectedHandler()}
        />
      ),
    };
    return [select, ...columns];
  }, [columns, selectable]);

  const table = useTable({
    features: dataTableFeatures,
    columns: allColumns,
    data,
    getRowId: (row: T) => getRowId(row),
    enableRowSelection:
      typeof selectable === "function"
        ? (row: Row<DataTableFeatures, T>) => selectable(row.original)
        : Boolean(selectable),
    state: { sorting, columnVisibility, rowSelection },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
  });

  // Drop selections for rows that disappeared (e.g. approved by someone else).
  const present = new Set(data.map(getRowId));
  const selectedIds = Object.keys(rowSelection).filter((id) => rowSelection[id] && present.has(id));
  const clear = () => setRowSelection({});
  const hideable = table.getAllLeafColumns().filter((c) => c.getCanHide());
  const rows = table.getRowModel().rows;
  const showToolbar = toolbar || columnToggle || (bulkActions && selectable);

  return (
    <div
      className={cx(
        "flex min-w-0 flex-col",
        !bare && "overflow-hidden rounded-md border border-line bg-surface",
        className,
      )}
    >
      {showToolbar && (
        <div className="flex min-h-10 items-center gap-2 border-b border-line px-3 py-1.5">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {selectedIds.length > 0 && bulkActions ? (
              <>
                <span className="num text-sm text-ink-2">{selectedIds.length} selected</span>
                {bulkActions(selectedIds, clear)}
                <button type="button" onClick={clear} className="text-xs text-ink-3 hover:text-ink">
                  Clear
                </button>
              </>
            ) : (
              toolbar
            )}
          </div>
          {columnToggle && hideable.length > 0 && (
            <Menu
              label="Columns"
              variant="ghost"
              size="xs"
              items={hideable.map((c) => ({ id: c.id, label: columnLabel(c) }))}
              selectedIds={hideable.filter((c) => c.getIsVisible()).map((c) => c.id)}
              onSelectionChange={(ids) =>
                setColumnVisibility(Object.fromEntries(hideable.map((c) => [c.id, ids.includes(c.id)])))
              }
            />
          )}
        </div>
      )}
      <div className="min-w-0 overflow-x-auto">
        <table className="w-full table-fixed border-collapse text-base">
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => {
                  const meta = header.column.columnDef.meta;
                  const sorted = header.column.getIsSorted();
                  const canSort = header.column.getCanSort();
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      style={{ width: meta?.width }}
                      aria-sort={
                        sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined
                      }
                      className={cx(
                        "h-8 whitespace-nowrap border-b border-line bg-surface-2 px-3 text-xs font-medium text-ink-3",
                        alignClass[meta?.align ?? "left"],
                        header.column.id === "__select" && "pr-0",
                      )}
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className={cx(
                            "inline-flex items-center gap-1 hover:text-ink",
                            sorted && "text-ink",
                            meta?.align === "right" && "flex-row-reverse",
                          )}
                        >
                          <table.FlexRender header={header} />
                          <SortGlyph dir={sorted} />
                        </button>
                      ) : (
                        <table.FlexRender header={header} />
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.map((row) => {
              const active = activeRowId === row.id;
              return (
                <tr
                  key={row.id}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  aria-selected={selectable ? row.getIsSelected() : undefined}
                  className={cx(
                    "group border-b border-line last:border-b-0",
                    onRowClick && "cursor-pointer",
                    active ? "bg-surface-3" : row.getIsSelected() ? "bg-surface-2" : "hover:bg-surface-2",
                    rowClassName?.(row.original),
                  )}
                >
                  {row.getVisibleCells().map((cell) => {
                    const meta = cell.column.columnDef.meta;
                    return (
                      <td
                        key={cell.id}
                        className={cx(
                          "h-9 px-3 py-1.5 align-middle text-ink",
                          alignClass[meta?.align ?? "left"],
                          meta?.align === "right" && "num",
                          !meta?.wrap && "max-w-0 truncate",
                          cell.column.id === "__select" && "w-8 pr-0",
                          meta?.className,
                        )}
                      >
                        <table.FlexRender cell={cell} />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
          {totals && rows.length > 0 && (
            <tfoot>
              {table.getFooterGroups().map((group) => (
                <tr key={group.id} className="border-t border-line-strong bg-surface-2">
                  {group.headers.map((header) => {
                    const meta = header.column.columnDef.meta;
                    return (
                      <td
                        key={header.id}
                        className={cx(
                          "h-9 px-3 py-1.5 text-sm font-medium text-ink",
                          alignClass[meta?.align ?? "left"],
                          meta?.align === "right" && "num",
                          "whitespace-nowrap",
                        )}
                      >
                        {header.isPlaceholder ? null : <table.FlexRender footer={header} />}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tfoot>
          )}
        </table>
        {rows.length === 0 && (empty ?? <EmptyState compact title="Nothing here yet" />)}
      </div>
    </div>
  );
}

function SortGlyph({ dir }: { dir: false | "asc" | "desc" }) {
  return (
    <svg
      viewBox="0 0 8 10"
      className={cx("size-2.5 shrink-0", dir ? "text-ink-2" : "text-ink-4")}
      aria-hidden="true"
    >
      <path
        d="M1 4l3-3 3 3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        opacity={dir === "desc" ? 0.3 : 1}
      />
      <path
        d="M1 6l3 3 3-3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        opacity={dir === "asc" ? 0.3 : 1}
      />
    </svg>
  );
}
