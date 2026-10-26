import { useInfiniteQuery, useQueries, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { accountsQuery } from "@/features/accounts";
import { payeesQuery, useScale } from "@/features/setup";
import {
  categorizationsQuery,
  transactionsInfiniteQuery,
} from "@/features/transactions/api";
import type { TransactionSearch } from "@/features/transactions/search";
import { transactionRow } from "@/features/transactions/transaction-row";
import type { TransactionRow } from "@/features/transactions/transaction-row";

type Transaction = components["schemas"]["Transaction"];

type Categorization = components["schemas"]["Categorization"];

export interface ListRow extends TransactionRow {
  transaction: Transaction;
  // How the categories were decided; absent until known, or when nothing decided them.
  categorization?: Categorization | undefined;
}

export interface TransactionList {
  rows: ListRow[];
  // No rows to show yet: the grid draws its placeholders.
  pending: boolean;
  // Rows on screen while a newer answer is on its way: the grid dims them.
  refreshing: boolean;
  error: Error | null;
  hasMore: boolean;
  loadMore: () => void;
  retry: () => void;
}

const pageSize = 30;

// A module constant: useQueries keeps the combined map while no answer changes, so the rows
// keep their identity.
function byTransaction(
  results: readonly { data?: { items: Categorization[] } | undefined }[],
): Map<string, Categorization> {
  return new Map(
    results.flatMap((r) =>
      (r.data?.items ?? []).map((c) => [c.transaction_id, c] as const),
    ),
  );
}

export function useTransactionList(search: TransactionSearch): TransactionList {
  const api = useApi();
  // A page of 30 fills a desktop's frame twice; every row mounted costs its style matching
  // (Slotted finding "Every element with a data-part attribute is matched against about 4 900
  // selectors"), so the first paint mounts no more than that.
  const list = useInfiniteQuery(
    transactionsInfiniteQuery(api, { ...search, limit: pageSize }),
  );
  const accounts = useQuery(accountsQuery(api));
  const payees = useQuery(payeesQuery(api));
  const scale = useScale();
  // One call per page of the list; a failed call leaves its rows without a mark.
  const decided = useQueries({
    queries: (list.data?.pages ?? [])
      .filter((page) => page.items.length > 0)
      .map((page) =>
        categorizationsQuery(
          api,
          page.items.map((tx) => tx.id),
        ),
      ),
    combine: byTransaction,
  });

  const rows = useMemo(() => {
    if (list.data === undefined || accounts.data === undefined) return [];
    const accountsById = new Map(accounts.data.map((a) => [a.id, a]));
    const payeeNames = new Map((payees.data ?? []).map((p) => [p.id, p.name]));
    return list.data.pages.flatMap((page) =>
      page.items.map((tx) => ({
        ...transactionRow(tx, accountsById, payeeNames, search.account_id),
        transaction: tx,
        categorization: decided.get(tx.id),
      })),
    );
  }, [list.data, accounts.data, payees.data, search.account_id, decided]);

  const failed = [list, accounts, payees].find((q) => q.isError);
  const ready =
    list.data !== undefined && accounts.data !== undefined && scale !== null;
  return {
    rows: ready ? rows : [],
    pending: !ready && failed === undefined,
    refreshing: ready && list.isFetching && !list.isFetchingNextPage,
    error: failed?.error ?? null,
    hasMore: list.hasNextPage,
    loadMore: () => {
      // An answer already on its way is kept rather than asked again.
      void list.fetchNextPage({ cancelRefetch: false });
    },
    retry: () => {
      for (const query of [list, accounts, payees]) {
        if (query.isError) void query.refetch();
      }
    },
  };
}
