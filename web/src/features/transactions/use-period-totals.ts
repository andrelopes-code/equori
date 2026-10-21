import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useApi } from "@/api/api-context";
import { accountsQuery } from "@/features/accounts";
import { searchTransactionsQuery } from "@/features/transactions/api";
import { periodTotals } from "@/features/transactions/period-totals";
import type { PeriodTotals } from "@/features/transactions/period-totals";
import type { TransactionSearch } from "@/features/transactions/search";
import { transactionRow } from "@/features/transactions/transaction-row";

// The totals of every transaction the search keeps, read only when a period bounds the search:
// an open search would page through the whole ledger.
export function usePeriodTotals(search: TransactionSearch): {
  totals: PeriodTotals | null;
  pending: boolean;
} {
  const api = useApi();
  const bounded = search.from !== undefined && search.to !== undefined;
  const query = useQuery({
    ...searchTransactionsQuery(api, search),
    enabled: bounded,
  });
  const accounts = useQuery(accountsQuery(api));
  const totals = useMemo(() => {
    if (query.data === undefined || accounts.data === undefined) return null;
    const accountsById = new Map(accounts.data.map((a) => [a.id, a]));
    return periodTotals(
      query.data.map((tx) =>
        transactionRow(tx, accountsById, new Map(), search.account_id),
      ),
    );
  }, [query.data, accounts.data, search.account_id]);
  return {
    totals: bounded ? totals : null,
    pending: bounded && query.isPending,
  };
}
