import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { accountsQuery, balancesQuery } from "@/features/accounts";
import { useScale } from "@/features/setup";
import { formatMoney } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";

// Complete frontend F1 and F2: the sentence that states what the entry leaves in its account,
// in the ledger's accent. Null until the amount, the account and its balance are known.
export function useBalanceAfter({
  accountId,
  mode,
  amount,
  enabled = true,
}: {
  accountId: string | null;
  mode: "expense" | "income" | "transfer";
  amount: number | null;
  enabled?: boolean;
}): string | null {
  const t = useT();
  const [locale] = useAppLocale();
  const api = useApi();
  const scale = useScale();
  const accounts = useQuery(accountsQuery(api));
  const balances = useQuery({
    ...balancesQuery(api, useToday(), "booked"),
    enabled,
  });
  const account = accounts.data?.find((a) => a.id === accountId);
  const balance = balances.data?.find((b) => b.account_id === accountId);
  if (amount === null || account === undefined || balance === undefined) {
    return null;
  }
  if (scale === null) return null;
  const currency = balance.balance.currency;
  const after = balance.balance.amount + (mode === "income" ? 1 : -1) * amount;
  const money = (value: number) =>
    formatMoney({ amount: value, currency }, scale(currency), locale);
  if (account.class === "liability") {
    return t("entry.impact.owes", {
      account: account.name,
      amount: money(-after),
    });
  }
  return t(mode === "income" ? "entry.impact.rises" : "entry.impact.left", {
    account: account.name,
    amount: money(after),
  });
}
