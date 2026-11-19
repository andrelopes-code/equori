import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { accountsQuery, balancesQuery } from "@/features/accounts";
import { addressKeys } from "@/features/calculators/debt-payoff-calculator/address-keys";
import {
  decodeDebts,
  encodeDebts,
  maxDebts,
} from "@/features/calculators/debt-payoff-calculator/debt-rows";
import type { DebtRow } from "@/features/calculators/debt-payoff-calculator/debt-rows";
import { useCalculatorSearch } from "@/features/calculators/model/calculator-search";
import { useToday } from "@/i18n/today";

const debtKinds = new Set(["loan", "credit_card"]);

// The debts rows: the address's rows, or one row per loan and card of the base currency that
// owes an amount today. owed maps an account id to what it owes, for the note of a filled row.
export function useDebtRows(currency: string | null): {
  rows: readonly DebtRow[];
  owed: ReadonlyMap<string, { name: string; amount: number }>;
  setRows: (next: readonly DebtRow[]) => void;
} {
  const api = useApi();
  const today = useToday();
  const [search, set] = useCalculatorSearch(addressKeys);
  const accounts = useQuery(accountsQuery(api)).data;
  const balances = useQuery(balancesQuery(api, today, "booked")).data;

  // A liability's balance is negative.
  const owed = new Map<string, { name: string; amount: number }>();
  for (const a of accounts ?? []) {
    if (
      a.class !== "liability" ||
      a.kind === undefined ||
      !debtKinds.has(a.kind)
    )
      continue;
    const b = balances?.find((x) => x.account_id === a.id)?.balance;
    if (b?.currency === currency && b.amount < 0)
      owed.set(a.id, { name: a.name, amount: -b.amount });
  }
  const filled: DebtRow[] = [...owed].slice(0, maxDebts).map(([id, o]) => ({
    name: o.name,
    balance: String(o.amount),
    rate: "",
    minimum: "",
    account: id,
  }));
  const rows =
    search.debts === undefined ? filled : (decodeDebts(search.debts) ?? []);

  return {
    rows,
    owed,
    setRows: (next) => {
      set({ debts: encodeDebts(next) });
    },
  };
}
