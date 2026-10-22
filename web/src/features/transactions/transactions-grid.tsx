import { emptyQuery } from "@slotted/core/grid";
import type { GridCell, GridColumn } from "@slotted/core/grid";
import { DataGrid } from "@slotted/react/data-grid";
import type {
  DataGridEditorContext,
  DataGridHandle,
} from "@slotted/react/data-grid";
import type { KeyboardEvent, ReactNode } from "react";
import { useCallback, useMemo, useRef } from "react";

import type { CategoryEntry } from "@/features/categories";
import { AmountCell } from "@/features/transactions/amount-cell";
import { CategoryCell } from "@/features/transactions/category-cell";
import { CategoryEditor } from "@/features/transactions/category-editor";
import { DayHeader } from "@/features/transactions/day-header";
import { TitleCell } from "@/features/transactions/title-cell";
import type {
  ListRow,
  TransactionList,
} from "@/features/transactions/use-transaction-list";
import { formatDate, formatDayHeader, formatMoney } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";

export function TransactionsGrid({
  list,
  categories,
  scale,
  height,
  selection,
  onSelectionChange,
  onOpen,
  onCategoryCommit,
  onCategorizeSelection,
  empty,
}: {
  list: TransactionList;
  categories: Map<string, CategoryEntry>;
  scale: (code: string) => number;
  // Absent below 600 px, where the grid is as tall as its rows and the page scrolls.
  height: string | undefined;
  selection: readonly string[];
  onSelectionChange: (ids: readonly string[]) => void;
  onOpen: (id: string) => void;
  // Resolves once the category is written; a rejection reopens the editor with its message.
  onCategoryCommit: (row: ListRow, categoryId: string) => Promise<void>;
  onCategorizeSelection: () => void;
  empty: (status: "empty" | "no-results" | "error") => ReactNode;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const today = useToday();
  const handle = useRef<DataGridHandle>(null);
  const current = useRef<GridCell | null>(null);

  const editCategory = useCallback((key: string) => {
    handle.current?.startEdit({ row: key, column: "category" });
  }, []);

  // C categorizes the selection, or the row the cursor stands on.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key.toLowerCase() !== "c") return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.target instanceof Element && event.target.closest("input")) {
      return;
    }
    const row = current.current?.row;
    if (selection.length > 0) {
      event.preventDefault();
      onCategorizeSelection();
    } else if (typeof row === "string" && list.rows.some((r) => r.id === row)) {
      event.preventDefault();
      editCategory(row);
    }
  };

  const columns = useMemo<GridColumn<ListRow>[]>(
    () => [
      {
        // Hidden: the rows are grouped by it, and each day's group row names it.
        id: "date",
        label: t("transactions.column.date"),
        accessor: "date",
        width: 104,
        format: (value) => {
          const iso = String(value);
          return iso.startsWith(today.slice(0, 4))
            ? formatDayHeader(iso, today, locale, {
                today: t("day.today"),
                yesterday: t("day.yesterday"),
              })
            : formatDate(iso, locale);
        },
      },
      {
        id: "title",
        label: t("transactions.column.description"),
        accessor: "title",
        rowHeader: true,
        flex: 2,
        // Narrow enough that the amount keeps its column beside it on a 390 px phone.
        minWidth: 150,
      },
      {
        id: "category",
        label: t("transactions.column.category"),
        accessor: "category",
        editable: (row) => !row.voided && !row.transfer,
        flex: 1,
        minWidth: 160,
        maxWidth: 280,
        priority: 2,
      },
      {
        id: "tags",
        label: t("transactions.column.tags"),
        accessor: (row) => row.tags.join(", "),
        width: 160,
        priority: 5,
        // Without room the tags leave the row rather than lengthen it on a phone.
        popin: false,
      },
      {
        id: "amount",
        label: t("transactions.column.amount"),
        accessor: (row) => row.money.amount,
        numeric: true,
        width: 148,
        priority: 1,
        format: (_value, row) =>
          formatMoney(row.money, scale(row.money.currency), locale),
      },
    ],
    [t, locale, today, scale],
  );

  const titles = useMemo(
    () => new Map(list.rows.map((row) => [row.id, row.title])),
    [list.rows],
  );

  // Renderers keep their identity across renders, so a page render that does not touch the
  // rows does not hand the grid new cells.
  const cellRenderers = useMemo(
    () => ({
      title: ({ row }: { row: ListRow }) => (
        <TitleCell
          row={row}
          category={categories.get(row.categoryIds[0] ?? "")}
        />
      ),
      category: ({ row }: { row: ListRow }) => (
        <CategoryCell
          row={row}
          categories={categories}
          onCategorize={
            row.voided || row.transfer
              ? undefined
              : () => {
                  editCategory(row.id);
                }
          }
        />
      ),
      amount: ({ row, text }: { row: ListRow; text: string }) => (
        <AmountCell row={row} text={text} />
      ),
    }),
    [categories, editCategory],
  );
  const editorRenderers = useMemo(
    () => ({
      category: ({
        row,
        draft,
        setDraft,
        commit,
      }: DataGridEditorContext<ListRow>) => (
        <CategoryEditor
          draft={draft}
          setDraft={setDraft}
          commit={commit}
          amount={row.money.amount}
        />
      ),
    }),
    [],
  );

  return (
    <DataGrid
      handle={handle}
      aria-label={t("nav.transactions")}
      aria-keyshortcuts="C"
      onKeyDown={onKeyDown}
      onCurrentChange={(cell) => {
        current.current = cell;
      }}
      onEditCommit={async (commit) => {
        if (commit.column !== "category" || typeof commit.value !== "string") {
          return;
        }
        await onCategoryCommit(commit.row, commit.value);
      }}
      editorRenderers={editorRenderers}
      columns={columns}
      defaultColumnState={{ hidden: ["date"] }}
      defaultQuery={{ ...emptyQuery(), group: ["date"] }}
      variant="framed"
      rowHeight={56}
      // Workaround for Slotted finding "Data-grid rows re-render on every scroll step and every
      // selection change": a windowed grid re-renders every row on each wheel step (120 to 170 ms
      // per step measured), while mounted rows scroll natively. The list grows a page of 50 at a
      // time as the reader scrolls, so the rows mounted are the rows the reader reached.
      virtualize={false}
      rows={list.rows}
      rowKey="id"
      {...(height === undefined ? {} : { height })}
      // Workaround for Slotted finding "A server-mode data-grid does not group the rows it is
      // given": the server already orders and filters, and client mode with an empty sort keeps
      // that order while it groups by day.
      mode="client"
      hasMore={list.hasMore}
      onLoadMore={list.loadMore}
      // Workaround for Slotted finding "Toggling aria-busy restyles every element below it": the
      // grid's loading writes aria-busy, which costs 340 ms at 70 rows, so it covers the first
      // read only and the header's bar shows a refresh.
      loading={list.pending}
      error={list.error === null ? null : t("transactions.loadFailed")}
      onRetry={list.retry}
      showRange={false}
      selectionMode="multiple"
      value={selection}
      onValueChange={(value) => {
        onSelectionChange(typeof value === "string" ? [value] : (value ?? []));
      }}
      activatable
      onActivate={(event) => {
        onOpen(event.key);
      }}
      renderEmpty={empty}
      messages={{
        // Workaround for Slotted finding "The selection checkbox of a data-grid row is named by its key".
        selectRow: ({ row }) =>
          t("transactions.selectRow", { row: titles.get(row) ?? row }),
      }}
      cellRenderers={cellRenderers}
      renderGroup={({ node }) => (
        <DayHeader label={node.text} rows={node.rows} scale={scale} />
      )}
    />
  );
}
