import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import {
  accountsQuery,
  allAccountTransactionsQuery,
  balanceQuery,
  balancesQuery,
  reconciliationQuery,
  seriesQuery,
} from "@/features/accounts/api";
import { historyStart } from "@/features/accounts/kind-figures/history-start";
import {
  acquisition,
  financingLoans,
  valueChange,
} from "@/features/accounts/model/property-figures";
import { useToday } from "@/i18n/today";

type Account = components["schemas"]["Account"];

export interface Financing {
  // The debt of the loans in the property's currency that financed it (K3, K4).
  debt: number;
  loans: Account[];
}

// The figures of a property: its value, its acquisition, the change since then, the loans that
// financed it and the date of its last valuation (K1 to K4).
export function usePropertyFigures(account: Account, withFinancing = true) {
  const api = useApi();
  const today = useToday();
  const from = historyStart(account.opened_on, today);
  const series = useQuery(seriesQuery(api, account.id, from, today));
  const booked = useQuery(balanceQuery(api, account.id, today, "booked"));
  const accounts = useQuery({ ...accountsQuery(api), enabled: withFinancing });
  const transactions = useQuery({
    ...allAccountTransactionsQuery(api, account.id, from, today),
    enabled: withFinancing,
  });
  const balances = useQuery({
    ...balancesQuery(api, today, "booked"),
    enabled: withFinancing,
  });
  const reconciliation = useQuery(reconciliationQuery(api, account.id));

  const bought =
    series.data === undefined ? undefined : acquisition(series.data.items);
  const value = booked.data?.balance.amount;
  const change =
    bought === undefined || value === undefined
      ? undefined
      : valueChange(value, bought.value);
  const financing = financingOf(
    account,
    accounts.data,
    transactions.data,
    balances.data,
  );

  return {
    value,
    bought,
    change,
    financing,
    valuedOn: reconciliation.data?.last_reconciled_on,
    series: series.data?.items,
    loading: series.isPending || booked.isPending,
  };
}

function financingOf(
  account: Account,
  accounts: Account[] | undefined,
  transactions: components["schemas"]["Transaction"][] | undefined,
  balances: components["schemas"]["Balance"][] | undefined,
): Financing | undefined {
  if (accounts === undefined || transactions === undefined) return undefined;
  if (balances === undefined) return undefined;

  // C2: a loan in another currency is not subtracted from the property's value.
  const loanIds = new Set(
    accounts
      .filter((a) => a.kind === "loan" && a.currency === account.currency)
      .map((a) => a.id),
  );
  const ids = financingLoans(account.id, transactions, loanIds);
  if (ids.length === 0) return undefined;

  const loans = accounts.filter((a) => ids.includes(a.id));
  const debt = balances
    .filter((b) => ids.includes(b.account_id))
    .reduce((sum, b) => sum - b.balance.amount, 0);

  return { debt, loans };
}
