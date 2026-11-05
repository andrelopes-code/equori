import { useQueries, useQuery } from "@tanstack/react-query";

import type { components } from "@/api/schema.gen";
import { useApi } from "@/api/api-context";
import { accountsQuery } from "@/features/accounts";
import { forecastDays, variableForecast } from "@/features/forecast";
import type { ForecastPoint, RecurringEstimate } from "@/features/forecast";
import { mergeEvents, monthEnd, shiftMonth } from "@/features/overview";
import type { ForecastEvent } from "@/features/overview";
import {
  occurrencesQuery,
  projectionQuery,
  schedulesQuery,
} from "@/features/planning";
import { forecastEntries } from "@/features/reports/forecast-entries";
import { settingsQuery } from "@/features/setup";
import { periodTransactionsQuery } from "@/features/transactions";
import { useToday } from "@/i18n/today";

type Account = components["schemas"]["Account"];
type Transaction = components["schemas"]["Transaction"];
type Projection = components["schemas"]["Projection"];
type Schedule = components["schemas"]["Schedule"];

export interface NetWorthForecast {
  history: number;
  points: ForecastPoint[];
  // The scheduled occurrences and the recurring estimates, each drawn as a line on its day.
  events: ForecastEvent[];
  recurring: RecurringEstimate[];
}

// The history covers six complete months; occurrences are read a month further back, so a
// transaction realized late on an occurrence of the month before still counts as scheduled.
const historyMonths = 6;

// The forecast of the net worth to the month's end, from today's net worth `start`; undefined
// when the month, the valuation currency or today leave none (net worth forecast design, F1), and
// while an input loads or after one fails.
export function useNetWorthForecast(
  month: string,
  valueIn: string,
  start: number | undefined,
): NetWorthForecast | undefined {
  const api = useApi();
  const today = useToday();
  const settings = useQuery(settingsQuery(api));
  const accounts = useQuery(accountsQuery(api));

  const base = settings.data?.base_currency;
  const end = monthEnd(month);
  const enabled =
    month === today.slice(0, 7) && today < end && base === valueIn;
  const from = `${shiftMonth(month, -historyMonths)}-01`;
  const scope = enabled ? balanceAccounts(accounts.data ?? [], valueIn) : [];

  const history = useQuery({
    ...periodTransactionsQuery(api, from, today),
    enabled,
  });
  const realized = useQuery({
    ...occurrencesQuery(
      api,
      `${shiftMonth(month, -historyMonths - 1)}-01`,
      today,
      { state: "realized" },
    ),
    enabled,
  });
  const schedules = useQuery({ ...schedulesQuery(api), enabled });
  const projections = useQueries({
    queries: scope.map((account) => projectionQuery(api, account.id, end)),
  });

  const ready =
    enabled &&
    start !== undefined &&
    accounts.data !== undefined &&
    history.data !== undefined &&
    realized.data !== undefined &&
    schedules.data !== undefined &&
    projections.every((query) => query.data !== undefined);

  if (!ready) return undefined;

  return forecastOf({
    accounts: accounts.data,
    transactions: history.data,
    realized: realized.data,
    schedules: schedules.data,
    projections: projections.map((query) => query.data),
    month,
    today,
    start,
    base: valueIn,
  });
}

// Every open balance account in the valuation currency: a transfer between two of them nets to
// zero in the merged projection (F3).
function balanceAccounts(accounts: readonly Account[], currency: string) {
  return accounts.filter(
    (account) =>
      (account.class === "asset" || account.class === "liability") &&
      account.currency === currency &&
      account.closed_on === undefined,
  );
}

function forecastOf({
  accounts,
  transactions,
  realized,
  schedules,
  projections,
  month,
  today,
  start,
  base,
}: {
  accounts: readonly Account[];
  transactions: readonly Transaction[];
  realized: readonly { transaction_id?: string | undefined }[];
  schedules: readonly Schedule[];
  projections: readonly Projection[];
  month: string;
  today: string;
  start: number;
  base: string;
}): NetWorthForecast {
  const scheduled = new Set(realized.flatMap((o) => o.transaction_id ?? []));
  const categories = new Map(
    accounts.flatMap((account) =>
      account.class === "income" || account.class === "expense"
        ? [[account.id, { name: account.name, kind: account.class }] as const]
        : [],
    ),
  );
  const entries = forecastEntries(transactions, categories, base, scheduled);

  const events = mergeEvents(
    projections.map((projection) =>
      projection.points.map((point) => ({
        date: point.date,
        occurrence_id: point.occurrence_id,
        schedule_id: point.schedule_id,
        amount: point.amount.amount,
      })),
    ),
    new Map(schedules.map((schedule) => [schedule.id, schedule])),
  );
  const variable = variableForecast({ entries, month, today });

  return {
    history: variable.history,
    points: forecastDays({ month, today, start, scheduled: events, variable }),
    events,
    recurring: variable.recurring,
  };
}
