import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { accountsQuery, balancesQuery } from "@/features/accounts/api";
import { useValuedGroups } from "@/features/accounts/model/use-valued-groups";
import { instrumentsQuery, settingsQuery, useScale } from "@/features/setup";
import { useToday } from "@/i18n/today";

// The figures and the account list of the home page read the same four queries.
export function useBalanceGroups() {
  const api = useApi();
  const today = useToday();
  const scale = useScale();
  const accounts = useQuery(accountsQuery(api));
  const balances = useQuery(balancesQuery(api, today, "booked"));
  const settings = useQuery(settingsQuery(api));
  const instruments = useQuery(instrumentsQuery(api));
  const queries = [accounts, balances, settings, instruments];
  const failed = queries.find((q) => q.isError)?.error ?? null;
  const retry = () => {
    for (const query of queries) {
      if (query.isError) void query.refetch();
    }
  };
  const groups = useValuedGroups({
    accounts: accounts.data,
    balances: balances.data,
    base: settings.data?.base_currency,
    date: today,
    basis: "booked",
  });
  if (groups === undefined || scale === null) {
    return { groups: undefined, scale: null, failed, retry };
  }
  return { groups, scale, failed, retry };
}
