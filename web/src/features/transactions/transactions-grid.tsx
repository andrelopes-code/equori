import type { GridCell, GridColumn } from "@slotted/core/grid";
import { DataGrid } from "@slotted/react/data-grid";
import type { DataGridHandle } from "@slotted/react/data-grid";
import { Inline } from "@slotted/react/inline";
import { Tag } from "@slotted/react/tag";
import type { KeyboardEvent, ReactNode } from "react";
import { useMemo, useRef } from "react";

import type { CategoryEntry } from "@/features/categories";
import { AmountCell } from "@/features/transactions/amount-cell";
import { CategoryCell } from "@/features/transactions/category-cell";
import { CategoryEditor } from "@/features/transactions/category-editor";
import { TitleCell } from "@/features/transactions/title-cell";
import type {
  ListRow,
  TransactionList,
} from "@/features/transactions/use-transaction-list";
import { formatDate, formatDayMonth, formatMoney } from "@/i18n/format";
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
  const year = useToday().slice(0, 4);
  const handle = useRef<DataGridHandle>(null);
  const current = useRef<GridCell | null>(null);

  const editCategory = (key: string) => {
    handle.current?.startEdit({ row: key, column: "category" });
  };

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
        id: "date",
        label: t("transactions.column.date"),
        accessor: "date",
        width: 104,
        priority: 3,
        format: (value) => {
          const iso = String(value);
          return iso.startsWith(year)
            ? formatDayMonth(iso, locale)
            : formatDate(iso, locale);
        },
      },
      {
        id: "title",
        label: t("transactions.column.description"),
        accessor: "title",
        rowHeader: true,
        flex: 2,
        minWidth: 200,
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
        id: "accounts",
        label: t("transactions.column.account"),
        accessor: "accounts",
        flex: 1,
        minWidth: 140,
        maxWidth: 240,
        priority: 4,
      },
      {
        id: "tags",
        label: t("transactions.column.tags"),
        accessor: (row) => row.tags.join(", "),
        width: 160,
        priority: 5,
      },
      {
        id: "amount",
        label: t("transactions.column.amount"),
        accessor: (row) => row.money.amount,
        numeric: true,
        width: 136,
        priority: 1,
        format: (_value, row) =>
          formatMoney(row.money, scale(row.money.currency), locale),
      },
    ],
    [t, locale, year, scale],
  );

  const titles = useMemo(
    () => new Map(list.rows.map((row) => [row.id, row.title])),
    [list.rows],
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
      editorRenderers={{
        category: ({ row, draft, setDraft, commit }) => (
          <CategoryEditor
            draft={draft}
            setDraft={setDraft}
            commit={commit}
            amount={row.money.amount}
          />
        ),
      }}
      columns={columns}
      rows={list.rows}
      rowKey="id"
      {...(height === undefined ? {} : { height })}
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
      messages={{
        // Workaround for Slotted finding "The selection checkbox of a data-grid row is named by its key".
        selectRow: ({ row }) =>
          t("transactions.selectRow", { row: titles.get(row) ?? row }),
      }}
      cellRenderers={{
        title: ({ row }) => <TitleCell row={row} />,
        category: ({ row }) => (
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
        tags: ({ row }) =>
          row.tags.length === 0 ? null : (
            <Inline gap={1} wrap="nowrap">
              {row.tags.map((tag) => (
                <Tag key={tag} size="sm">
                  {tag}
                </Tag>
              ))}
            </Inline>
          ),
        amount: ({ row, text }) => <AmountCell row={row} text={text} />,
      }}
    />
  );
}
