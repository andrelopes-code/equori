import { Page, PageBody } from "@slotted/react/page";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useDeferredValue, useMemo } from "react";

import { useApi } from "@/api/api-context";
import { accountsQuery } from "@/features/accounts";
import { useCategoryEntries } from "@/features/categories";
import { payeesQuery } from "@/features/setup";
import { tagsQuery } from "@/features/transactions/api";
import { validateTransactionSearch } from "@/features/transactions/search";
import type { TransactionSearchDraft } from "@/features/transactions/search";
import { TransactionFilters } from "@/features/transactions/transaction-filters";
import { TransactionsFooter } from "@/features/transactions/transactions-footer";
import { TransactionsHeader } from "@/features/transactions/transactions-header";
import { TransactionsListing } from "@/features/transactions/transactions-listing";
import styles from "@/features/transactions/transactions-page.module.css";
import { useCategorizeActions } from "@/features/transactions/use-categorize-actions";
import { useSelectionCommands } from "@/features/transactions/use-selection-commands";
import { useTransactionList } from "@/features/transactions/use-transaction-list";
import { useT } from "@/i18n/i18n-provider";
import { BulkOutcomeNotice } from "@/ui/bulk-outcome-notice";

const listID = "transactions-list";

export function TransactionsPage() {
  const t = useT();
  const api = useApi();
  const navigate = useNavigate({ from: "/transactions" });
  const pageSearch = useSearch({ from: "/_authed/transactions" });
  // The selected row is the panel's; the list reads the filters alone.
  const search = useMemo(
    () => validateTransactionSearch(pageSearch),
    [pageSearch],
  );
  // The tab and the bar paint at once; the grid follows from the deferred search (CP-09).
  const shown = useDeferredValue(search);
  const list = useTransactionList(shown);
  const accounts = useQuery(accountsQuery(api));
  const payees = useQuery(payeesQuery(api));
  const tags = useQuery(tagsQuery(api));

  const categories = useCategoryEntries(accounts.data);
  const categoriesById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );
  const accountsById = useMemo(
    () => new Map((accounts.data ?? []).map((a) => [a.id, a])),
    [accounts.data],
  );
  const actions = useCategorizeActions(accountsById);
  const commands = useSelectionCommands(list.rows, categoriesById, actions);

  const labelOf = (id: string) => {
    const title = list.rows.find((row) => row.id === id)?.title ?? "";
    return title === "" ? t("ledger.untitled") : title;
  };

  const setSearch = (next: TransactionSearchDraft) => {
    commands.setSelection([]);
    void navigate({
      search: validateTransactionSearch({ ...next }),
      replace: next.q !== search.q,
    });
  };

  return (
    <Page
      width="full"
      fill
      footer={
        commands.selection.length > 0 ? (
          <TransactionsFooter
            commands={commands}
            categoriesById={categoriesById}
            suggestable={search.uncategorized === true}
          />
        ) : undefined
      }
    >
      <TransactionsHeader
        search={search}
        shown={shown}
        listRefreshing={list.refreshing}
        onSearchChange={setSearch}
        listID={listID}
      />

      <PageBody id={listID}>
        <div className={styles.region} aria-busy={shown !== search}>
          {commands.outcome !== null && (
            <BulkOutcomeNotice
              outcome={commands.outcome}
              summary="bulk.voided"
              labelOf={labelOf}
            />
          )}

          <TransactionFilters
            search={search}
            onSearchChange={setSearch}
            accounts={accounts.data ?? []}
            categories={categories}
            payees={payees.data ?? []}
            tags={tags.data ?? []}
            count={list.pending ? undefined : list.rows.length}
            hasMore={list.hasMore}
            loading={list.pending}
          />

          <TransactionsListing
            list={list}
            search={search}
            categoriesById={categoriesById}
            actions={actions}
            selection={commands.selection}
            onSelectionChange={commands.setSelection}
            onCategorizeSelection={() => {
              commands.setPicking(true);
            }}
            onSearchChange={setSearch}
          />
        </div>
      </PageBody>
    </Page>
  );
}
