import { Splitter } from "@slotted/react/splitter";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";

import { errorText } from "@/api/problem";
import type { CategoryEntry } from "@/features/categories";
import { useScale } from "@/features/setup";
import type {
  TransactionSearch,
  TransactionSearchDraft,
} from "@/features/transactions/search";
import { TransactionDetail } from "@/features/transactions/transaction-detail";
import { TransactionsEmpty } from "@/features/transactions/transactions-empty";
import { TransactionsGrid } from "@/features/transactions/transactions-grid";
import styles from "@/features/transactions/transactions-page.module.css";
import type { CategorizeActions } from "@/features/transactions/use-categorize-actions";
import type { TransactionList } from "@/features/transactions/use-transaction-list";
import { useT } from "@/i18n/i18n-provider";
import { compactQuery, useMediaQuery, wideQuery } from "@/ui/use-media-query";

interface TransactionsListingProps {
  list: TransactionList;
  search: TransactionSearch;
  categoriesById: Map<string, CategoryEntry>;
  actions: CategorizeActions;
  selection: readonly string[];
  onSelectionChange: (selection: readonly string[]) => void;
  onCategorizeSelection: () => void;
  onSearchChange: (next: TransactionSearchDraft) => void;
}

export function TransactionsListing({
  list,
  search,
  categoriesById,
  actions,
  selection,
  onSelectionChange,
  onCategorizeSelection,
  onSearchChange,
}: TransactionsListingProps) {
  const t = useT();

  const navigate = useNavigate({ from: "/transactions" });
  const pageSearch = useSearch({ from: "/_authed/transactions" });
  const scale = useScale();
  const compact = useMediaQuery(compactQuery);
  const wide = useMediaQuery(wideQuery);
  // The pane opens beside the list on a desktop; narrower, the record is its own page.
  const selected = wide ? pageSearch.selected : undefined;
  const closePane = () => {
    void navigate({ search: search, replace: true });
  };
  // The share of the row the list takes beside the open pane; it holds while a row opens and closes.
  const [split, setSplit] = useState(0.66);

  const queue = search.uncategorized === true;
  const filtered = Object.keys(search).some((key) => key !== "uncategorized");

  return (
    <div
      className={styles.listing}
      data-pane={selected === undefined ? undefined : ""}
    >
      <div className={styles.list}>
        {scale !== null && (
          <TransactionsGrid
            list={list}
            categories={categoriesById}
            scale={scale}
            height={compact ? undefined : "100%"}
            selection={selection}
            onSelectionChange={onSelectionChange}
            onCategoryCommit={async (row, categoryId) => {
              const category = categoriesById.get(categoryId);
              if (category === undefined) return;
              try {
                await actions.categorizeOne(row.transaction, category);
              } catch (error) {
                throw new Error(errorText(error, t), { cause: error });
              }
            }}
            onCategorizeSelection={onCategorizeSelection}
            onOpen={(id) => {
              if (wide) {
                void navigate({
                  search: { ...search, selected: id },
                  replace: pageSearch.selected !== undefined,
                });
              } else {
                void navigate({
                  to: "/transactions/$id",
                  params: { id },
                });
              }
            }}
            empty={(status) => (
              <TransactionsEmpty
                status={status}
                onRetry={list.retry}
                filtered={filtered}
                queue={queue}
                onClear={() => {
                  onSearchChange(queue ? { uncategorized: true } : {});
                }}
              />
            )}
          />
        )}
      </div>

      {selected !== undefined && (
        <Splitter
          aria-label={t("transactions.paneResize")}
          value={split}
          onValueChange={setSplit}
          min={0.4}
          max="calc(100% - 20rem)"
        />
      )}

      {selected !== undefined && (
        <div
          className={styles.pane}
          onKeyDown={(event) => {
            if (event.key === "Escape" && !event.defaultPrevented) {
              closePane();
            }
          }}
        >
          <TransactionDetail
            key={selected}
            id={selected}
            host="pane"
            onClose={closePane}
          />
        </div>
      )}
    </div>
  );
}
