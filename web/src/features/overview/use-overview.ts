import { useQueries, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useApi } from "@/api/api-context";
import {
  accountsQuery,
  seriesQuery,
  useBalanceGroups,
} from "@/features/accounts";
import { currentAndUnpaid, statementsQuery } from "@/features/cards";
import {
  buildForecast,
  cardsPaidBySchedule,
  lowestAhead,
  mergeEvents,
  monthEnd,
  shiftMonth,
  statementEvents,
  sumByDate,
} from "@/features/overview/forecast";
import type { ForecastDay } from "@/features/overview/forecast";
import { monthFlows } from "@/features/overview/month-flows";
import type { MonthFlows } from "@/features/overview/month-flows";
import { owedStatements } from "@/features/overview/open-statements";
import { projectionQuery, schedulesQuery } from "@/features/planning";
import { settingsQuery } from "@/features/setup";
import { periodTransactionsQuery } from "@/features/transactions";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";

export interface Overview {
  month: string;
  current: boolean;
  base: string;
  // Minor units: the booked balance at month end, or the forecast for the current month.
  closing: number;
  days: ForecastDay[];
  // The lowest forecast balance from today on; null for a past month.
  lowest: ReturnType<typeof lowestAhead>;
  flows: MonthFlows;
}

// Statements of the last year, as the cards block reads them, so both share one query.
const statementMonths = 12;

// The forecast covers the Available accounts in the base currency, and the card statements they
// pay (balance forecast design, B1).
export function useOverview(month: string): {
  overview: Overview | undefined;
  scale: ((currency: string) => number) | null;
  failed: Error | null;
  retry: () => void;
} {
  const t = useT();
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
  const cards = current
    ? (accounts.data ?? []).filter(
        (account) =>
          account.kind === "credit_card" && account.closed_on === undefined,
      )
    : [];
  const statements = useQueries({
    queries: cards.map((card) =>
      statementsQuery(api, card.id, shiftMonth(month, -statementMonths)),
    ),
  });
  const schedules = useQuery(schedulesQuery(api));
  const transactions = useQuery(
    periodTransactionsQuery(api, start, realizedTo),
  );

  const all = [
    settings,
    accounts,
    schedules,
    transactions,
    ...series,
    ...projections,
    ...statements,
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
    const points = projections.flatMap((query) => query.data?.points ?? []);
    const scheduled = mergeEvents(
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
    const owed = statementEvents({
      owed: owedStatements(
        cards.map((account, i) => ({
          account,
          ...currentAndUnpaid(statements[i]?.data ?? []),
        })),
      ),
      base,
      today: todayISO,
      end,
      paid: cardsPaidBySchedule(
        points,
        new Map((schedules.data ?? []).map((s) => [s.id, s])),
        end,
      ),
      describe: (card) => t("overview.balance.statement", { card }),
    });
    const events = [...scheduled, ...owed];
    const days = buildForecast({
      month,
      today: current ? todayISO : end,
      realized,
      todayBalance,
      events,
    });
    const accountsById = new Map(
      (accounts.data ?? []).map((account) => [account.id, account]),
    );
    overview = {
      month,
      current,
      base,
      closing: days.at(-1)?.forecast ?? days.at(-1)?.realized ?? 0,
      days,
      lowest: current ? lowestAhead(days) : null,
      flows: monthFlows(
        transactions.data ?? [],
        new Set(scope.map((account) => account.id)),
        accountsById,
      ),
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
