import { useQueries, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useApi } from "@/api/api-context";
import { accountsQuery, positionsQuery } from "@/features/accounts";
import { valuedBalanceQuery } from "@/features/portfolio/api";
import {
  brokerageCashAccounts,
  buildHoldings,
  holdingsSummary,
} from "@/features/portfolio/portfolio-holdings";
import { instrumentsQuery } from "@/features/setup";

// The rows of the portfolio at a date: positions, the brokerage cash and their one total.
export function useHoldings(date: string, valueIn: string | undefined) {
  const api = useApi();
  const positions = useQuery({
    ...positionsQuery(api, date, valueIn),
    enabled: valueIn !== undefined,
  });
  const accounts = useQuery(accountsQuery(api));
  const instruments = useQuery(instrumentsQuery(api));

  const cashAccounts = useMemo(
    () =>
      brokerageCashAccounts(
        accounts.data ?? [],
        instruments.data?.items ?? [],
        date,
      ),
    [accounts.data, instruments.data, date],
  );

  const cash = useQueries({
    queries: cashAccounts.map((a) =>
      valuedBalanceQuery(api, a.id, date, valueIn),
    ),
    combine: (results) => ({
      pending: results.some((r) => r.isPending),
      balances: results.map((r, i) => ({
        accountID: cashAccounts[i]?.id ?? "",
        ...(r.data === undefined ? {} : { balance: r.data.balance }),
      })),
    }),
  });

  const holdings = useMemo(
    () =>
      buildHoldings({
        positions: positions.data ?? [],
        accounts: accounts.data ?? [],
        instruments: instruments.data?.items ?? [],
        cash: cash.balances,
      }),
    [positions.data, accounts.data, instruments.data, cash.balances],
  );
  const summary = useMemo(() => holdingsSummary(holdings), [holdings]);

  const pending =
    valueIn === undefined ||
    positions.isPending ||
    accounts.isPending ||
    instruments.isPending ||
    cash.pending;

  return { holdings, summary, pending, positions, accounts };
}
