import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import {
  accountsQuery,
  allAccountTransactionsQuery,
  balanceQuery,
} from "@/features/accounts/api";
import { historyStart } from "@/features/accounts/kind-figures/history-start";
import {
  loanFigures,
  remainingInstallments,
} from "@/features/accounts/model/loan-figures";
import { schedulesQuery } from "@/features/planning";
import { useToday } from "@/i18n/today";

type Account = components["schemas"]["Account"];

// The figures of a loan: what it lent, what it owes, what was repaid, the interest paid and the
// installments its schedule still holds (K5 to K7).
export function useLoanFigures(account: Account) {
  const api = useApi();
  const today = useToday();
  const from = historyStart(account.opened_on, today);
  const booked = useQuery(balanceQuery(api, account.id, today, "booked"));
  const transactions = useQuery(
    allAccountTransactionsQuery(api, account.id, from, today),
  );
  const accounts = useQuery(accountsQuery(api));
  const schedules = useQuery(schedulesQuery(api));

  const interestIds = new Set(
    (accounts.data ?? [])
      .filter((a) => a.system_role === "interest")
      .map((a) => a.id),
  );
  const figures =
    booked.data === undefined ||
    transactions.data === undefined ||
    accounts.data === undefined
      ? undefined
      : loanFigures(
          account.id,
          booked.data.balance.amount,
          transactions.data,
          interestIds,
        );
  const remaining =
    schedules.data === undefined
      ? undefined
      : remainingInstallments(account.id, schedules.data, today);

  return {
    figures,
    remaining,
    loading: booked.isPending || transactions.isPending,
  };
}
