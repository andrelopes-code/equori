import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import { errorText } from "@/api/problem";
import { accountsQuery } from "@/features/accounts";
import { expenseCandidates } from "@/features/goals/goal-expenses/expense-candidates";
import type { Goal } from "@/features/goals/goal-card/goal-line";
import {
  goalExpensesQuery,
  useLinkGoalExpense,
  useUnlinkGoalExpense,
} from "@/features/planning";
import { periodTransactionsQuery } from "@/features/transactions";
import { shiftDate } from "@/i18n/format";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";

// Without a withdrawal to explain, the expenses of the last 60 days are offered.
const recentDays = 60;

// The expenses a goal pays, the expenses it can still pay since its withdrawal, and the two
// writes over them (planning coherence A256).
export function useGoalExpenses(goal: Goal) {
  const t = useT();
  const api = useApi();
  const today = useToday();
  const since =
    goal.unexplained_withdrawal?.since ?? shiftDate(today, -recentDays);
  const paid = useQuery(goalExpensesQuery(api, goal.id));
  const accounts = useQuery(accountsQuery(api));
  const period = useQuery(periodTransactionsQuery(api, since, today));
  const link = useLinkGoalExpense();
  const unlink = useUnlinkGoalExpense();
  const [error, setError] = useState<string | null>(null);

  const byID = new Map((accounts.data ?? []).map((a) => [a.id, a]));
  const candidates = expenseCandidates(
    period.data ?? [],
    byID,
    new Set((paid.data ?? []).map((e) => e.transaction_id)),
  );

  const run = (write: typeof link, transaction: string) => {
    setError(null);
    write
      .mutateAsync({ goal: goal.id, transaction })
      .catch((caught: unknown) => {
        setError(errorText(caught, t));
      });
  };

  return {
    since,
    paid: paid.data,
    candidates,
    loading: paid.data === undefined || period.data === undefined,
    pending: link.isPending || unlink.isPending,
    error,
    link: (transaction: string) => {
      run(link, transaction);
    },
    unlink: (transaction: string) => {
      run(unlink, transaction);
    },
  };
}
