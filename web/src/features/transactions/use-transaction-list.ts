import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { accountsQuery } from "@/features/accounts";
import { payeesQuery, useScale } from "@/features/setup";
import { transactionsInfiniteQuery } from "@/features/transactions/api";
import type { TransactionSearch } from "@/features/transactions/search";
import { transactionRow } from "@/features/transactions/transaction-row";
import type { TransactionRow } from "@/features/transactions/transaction-row";

type Transaction = components["schemas"]["Transaction"];

export interface ListRow extends TransactionRow {
  transaction: Transaction;
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

export function useTransactionList(search: TransactionSearch): TransactionList {
  const api = useApi();
  const list = useInfiniteQuery(transactionsInfiniteQuery(api, search));
  const accounts = useQuery(accountsQuery(api));
  const payees = useQuery(payeesQuery(api));
  const scale = useScale();

  const rows = useMemo(() => {
    if (list.data === undefined || accounts.data === undefined) return [];
    const accountsById = new Map(accounts.data.map((a) => [a.id, a]));
    const payeeNames = new Map((payees.data ?? []).map((p) => [p.id, p.name]));
    return list.data.pages.flatMap((page) =>
      page.items.map((tx) => ({
        ...transactionRow(tx, accountsById, payeeNames, search.account_id),
        transaction: tx,
      })),
    );
  }, [list.data, accounts.data, payees.data, search.account_id]);

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
