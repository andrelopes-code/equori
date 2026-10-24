import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { accountsQuery } from "@/features/accounts";
import { categoryTotalsQuery } from "@/features/categories";
import { monthEnd } from "@/features/overview/forecast";
import { topCategories } from "@/features/overview/top-categories";
import { useBase } from "@/features/overview/use-base";

// The five categories that took the most of the month, for the list and the chart alike.
export function useSpending(month: string) {
  const api = useApi();
  const { base, scale, error: baseError, retry: retryBase } = useBase();
  const totals = useQuery(
    categoryTotalsQuery(api, `${month}-01`, monthEnd(month), "expense"),
  );
  const accounts = useQuery(accountsQuery(api));
  const error = baseError ?? totals.error ?? accounts.error;
  const loading =
    totals.data === undefined ||
    accounts.data === undefined ||
    base === undefined ||
    scale === null;
  return {
    base,
    scale,
    error,
    loading: loading && error === null,
    rows:
      loading || error !== null
        ? []
        : topCategories(
            totals.data,
            new Map(accounts.data.map((account) => [account.id, account.name])),
          ),
    retry: () => {
      retryBase();
      if (totals.isError) void totals.refetch();
      if (accounts.isError) void accounts.refetch();
    },
  };
}
