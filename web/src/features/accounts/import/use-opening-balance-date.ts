import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import {
  accountsQuery,
  allAccountTransactionsQuery,
} from "@/features/accounts/api";
import { openingBalanceDate } from "@/features/accounts/import/opening-balance-date";
import { useToday } from "@/i18n/today";

// The date of the account's opening balance from the given day on; pending until it is known.
export function useOpeningBalanceDate(accountId: string, from: string) {
  const api = useApi();
  const today = useToday();
  const accounts = useQuery(accountsQuery(api));
  const openingBalances = accounts.data?.find(
    (a) => a.system_role === "opening_balances",
  )?.id;
  const entries = useQuery({
    ...allAccountTransactionsQuery(api, openingBalances ?? "", from, today),
    enabled: openingBalances !== undefined,
  });

  return {
    pending: entries.isPending,
    date: openingBalanceDate(entries.data ?? [], accountId),
  };
}
