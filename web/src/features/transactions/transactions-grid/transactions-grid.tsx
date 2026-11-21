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
import { AmountCell } from "@/features/transactions/transactions-grid/amount-cell";
import { CategoryCell } from "@/features/transactions/transactions-grid/category-cell";
import { CategoryEditor } from "@/features/transactions/transactions-grid/category-editor";
import { dayLabel } from "@/features/transactions/model/day-label";
import { DayHeader } from "@/features/transactions/transactions-grid/day-header";
import { TitleCell } from "@/features/transactions/transactions-grid/title-cell";
import type {
  ListRow,
  TransactionList,
} from "@/features/transactions/transactions-grid/use-transaction-list";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { useMoneyFormat } from "@/privacy/use-money-format";

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
  height: string;
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
  const fmt = useMoneyFormat();
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
        sortable: false,
        label: t("transactions.column.date"),
        accessor: "date",
        width: 104,
        format: (value) =>
          dayLabel(String(value), today, locale, {
            today: t("day.today"),
            yesterday: t("day.yesterday"),
          }),
      },
      {
        id: "title",
        sortable: false,
        label: t("transactions.column.description"),
        accessor: "title",
        rowHeader: true,
        flex: 2,
        minWidth: 150,
      },
      {
        id: "category",
        sortable: false,
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
        sortable: false,
        label: t("transactions.column.tags"),
        accessor: (row) => row.tags.join(", "),
        width: 160,
        priority: 5,
        // Without room the tags leave the row rather than lengthen it.
        popin: false,
      },
      {
        id: "amount",
        sortable: false,
        label: t("transactions.column.amount"),
        accessor: (row: ListRow) => row.money.amount,
        numeric: true,
        width: 148,
        priority: 1,
        format: (_value: unknown, row: ListRow) =>
          fmt.money(row.money, scale(row.money.currency)),
      },
    ],
    [t, locale, today, scale, fmt],
  );

  const messages = useMemo(
    () => ({
      selectRow: ({ row }: { row: string }) =>
        t("transactions.selectRow", { row }),
    }),
    [t],
  );
  const renderGroup = useCallback(
    ({ node }: { node: { text: string; rows: readonly ListRow[] } }) => (
      <DayHeader label={node.text} rows={node.rows} scale={scale} />
    ),
    [scale],
  );

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
      category: ({ row, setDraft, commit }: DataGridEditorContext<ListRow>) => (
        <CategoryEditor
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
      columnOverflow="popin"
      rowHeight={56}
      rows={list.rows}
      rowKey="id"
      height={height}
      mode="server"
      hasMore={list.hasMore}
      onLoadMore={list.loadMore}
      loading={list.pending || list.refreshing}
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
      messages={messages}
      cellRenderers={cellRenderers}
      renderGroup={renderGroup}
    />
  );
}
