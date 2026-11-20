import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { groupBalances } from "@/features/accounts/balance-sheet/balance-groups";
import type { BalanceGroup } from "@/features/accounts/balance-sheet/balance-groups";
import { netWorthQuery } from "@/features/overview";

type Account = components["schemas"]["Account"];
type Balance = components["schemas"]["Balance"];

interface ValuedGroupsInput {
  accounts: Account[] | undefined;
  balances: Balance[] | undefined;
  base: string | undefined;
  date: string;
  basis: string;
  includeClosed?: boolean;
}

// The groups by kind at a date. On the basis booked a balance in another currency adds its value
// in the base currency; on settled, or when the valuation fails, it stays out (VB2, VB4).
export function useValuedGroups({
  accounts,
  balances,
  base,
  date,
  basis,
  includeClosed = false,
}: ValuedGroupsInput): BalanceGroup[] | undefined {
  const api = useApi();
  const booked = basis === "booked";
  const worth = useQuery({
    ...netWorthQuery(api, date, base ?? ""),
    enabled: booked && base !== undefined,
  });

  const valuing = booked && worth.isPending;
  const values = useMemo(
    () =>
      new Map((worth.data?.accounts ?? []).map((a) => [a.account_id, a.value])),
    [worth.data],
  );

  return useMemo(
    () =>
      accounts === undefined ||
      balances === undefined ||
      base === undefined ||
      valuing
        ? undefined
        : groupBalances(accounts, balances, base, includeClosed, values),
    [accounts, balances, base, valuing, includeClosed, values],
  );
}
