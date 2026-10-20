import { useQueries, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import {
  accountsQuery,
  seriesQuery,
  useBalanceGroups,
} from "@/features/accounts";
import {
  buildForecast,
  lowestAhead,
  mergeEvents,
  monthDays,
  monthEnd,
  sumByDate,
} from "@/features/overview/forecast";
import type { ForecastDay, ForecastEvent } from "@/features/overview/forecast";
import { monthFlows } from "@/features/overview/month-flows";
import type { MonthFlows } from "@/features/overview/month-flows";
import {
  budgetProgressQuery,
  budgetsQuery,
  projectionQuery,
  schedulesQuery,
} from "@/features/planning";
import { settingsQuery } from "@/features/setup";
import { periodTransactionsQuery } from "@/features/transactions";
import { useToday } from "@/i18n/today";

type Account = components["schemas"]["Account"];

export interface BudgetLine {
  id: string;
  category: string;
  spent: number;
  planned: number;
  available: number;
}

export interface Overview {
  // No account exists yet: the page leads to Accounts instead of a forecast.
  noAccounts: boolean;
  month: string;
  current: boolean;
  base: string;
  scope: Account[];
  days: ForecastDay[];
  ahead: ForecastEvent[];
  today: number;
  opening: number;
  closing: number;
  lowest: ReturnType<typeof lowestAhead>;
  lowestRealized: { date: string; balance: number } | null;
  flows: MonthFlows;
  budgets: BudgetLine[];
  // The share of the month gone by: 1 for a past month.
  elapsed: number;
}

// The forecast covers the Available accounts in the base currency.
export function useOverview(month: string): {
  overview: Overview | undefined;
  scale: ((currency: string) => number) | null;
  failed: Error | null;
  retry: () => void;
} {
  const api = useApi();
  const todayISO = useToday();
  const { groups, scale, failed: groupsFailed, retry } = useBalanceGroups();
  const settings = useQuery(settingsQuery(api));
  const accounts = useQuery(accountsQuery(api));
  const base = settings.data?.base_currency;
  const scope = useMemo(
    () =>
      groups
        ?.find((g) => g.group === "available")
        ?.items.map((item) => item.account)
        .filter((account) => account.currency === base) ?? [],
    [groups, base],
  );
  const current = month === todayISO.slice(0, 7);
  const start = `${month}-01`;
  const end = monthEnd(month);
  const realizedTo = current ? todayISO : end;

  const series = useQueries({
    queries: scope.map((account) =>
      seriesQuery(api, account.id, start, realizedTo),
    ),
  });
  const projections = useQueries({
    queries: current
      ? scope.map((account) => projectionQuery(api, account.id, end))
      : [],
  });
  const schedules = useQuery(schedulesQuery(api));
  const transactions = useQuery(
    periodTransactionsQuery(api, start, realizedTo),
  );
  const budgets = useQuery(budgetsQuery(api));
  const activeBudgets = (budgets.data ?? []).filter((budget) =>
    budget.amounts.some((amount) => amount.effective_from <= month),
  );
  const progress = useQueries({
    queries: activeBudgets.map((budget) =>
      budgetProgressQuery(api, budget.id, month),
    ),
  });

  const all = [
    settings,
    accounts,
    schedules,
    transactions,
    budgets,
    ...series,
    ...projections,
    ...progress,
  ];
  const failed =
    groupsFailed ?? all.find((query) => query.error !== null)?.error ?? null;
  const pending =
    groups === undefined ||
    base === undefined ||
    all.some((query) => query.data === undefined);

  let overview: Overview | undefined;
  if (!pending && failed === null) {
    const scheduleInfo = new Map(
      (schedules.data ?? []).map((s) => [
        s.id,
        { description: s.description, kind: s.kind },
      ]),
    );
    const realized = sumByDate(series.map((query) => query.data?.items ?? []));
    const todayBalance = current
      ? projections.reduce(
          (sum, query) => sum + (query.data?.opening.amount ?? 0),
          0,
        )
      : (realized.get(end) ?? 0);
    const events = mergeEvents(
      projections.map((query) =>
        (query.data?.points ?? []).map((point) => ({
          date: point.date,
          occurrence_id: point.occurrence_id,
          schedule_id: point.schedule_id,
          amount: point.amount.amount,
        })),
      ),
      scheduleInfo,
    ).filter((event) => event.date <= end);
    const days = buildForecast({
      month,
      today: current ? todayISO : end,
      realized,
      todayBalance,
      events,
    });
    const realizedDays = days.filter((d) => d.realized !== undefined);
    const lowestRealized = realizedDays.reduce<{
      date: string;
      balance: number;
    } | null>(
      (low, d) =>
        d.realized !== undefined && (low === null || d.realized < low.balance)
          ? { date: d.date, balance: d.realized }
          : low,
      null,
    );
    const accountsById = new Map(
      (accounts.data ?? []).map((account) => [account.id, account]),
    );
    const names = new Map(
      (accounts.data ?? []).map((account) => [account.id, account.name]),
    );
    const dayOfMonth = Number(todayISO.slice(8, 10));
    overview = {
      noAccounts: groups.length === 0,
      month,
      current,
      base,
      scope,
      days,
      ahead: events.filter((event) => event.date > todayISO),
      today: todayBalance,
      opening: realizedDays[0]?.realized ?? 0,
      closing: days.at(-1)?.forecast ?? days.at(-1)?.realized ?? 0,
      lowest: current ? lowestAhead(days) : null,
      lowestRealized,
      flows: monthFlows(
        transactions.data ?? [],
        new Set(scope.map((account) => account.id)),
        accountsById,
      ),
      budgets: activeBudgets.flatMap((budget, i) => {
        const data = progress[i]?.data;
        if (data === undefined) return [];
        return [
          {
            id: budget.id,
            category: names.get(budget.category_id) ?? "",
            spent: data.spent.amount,
            planned: data.planned.amount + data.carried.amount,
            available: data.available.amount,
          },
        ];
      }),
      elapsed: current ? dayOfMonth / monthDays(month).length : 1,
    };
  }
  return {
    overview,
    scale,
    failed,
    retry: () => {
      retry();
      for (const query of all) {
        if (query.error !== null) void query.refetch();
      }
    },
  };
}
