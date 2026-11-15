import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { accountsQuery } from "@/features/accounts";
import {
  monthClose,
  pendingGroups,
  runningBalance,
} from "@/features/planning/agenda/month-close";
import { monthDays } from "@/features/planning/agenda/month-days";
import { occurrencesQuery, schedulesQuery } from "@/features/planning/api";
import { agenda, monthEnd } from "@/features/planning/model/agenda";
import type { AgendaFilter } from "@/features/planning/model/agenda";
import { settingsQuery, useScale } from "@/features/setup";
import { firstDayOfWeek, shiftDate } from "@/i18n/format";
import { useAppLocale } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";

// The month's rows and what the agenda derives from them (spec 4). The overdue occurrences of
// earlier months belong to the current month only (spec A2).
export function useAgendaMonth(month: string, filter: AgendaFilter) {
  const api = useApi();
  const [locale] = useAppLocale();
  const today = useToday();
  const scale = useScale();
  const occurrences = useQuery(
    occurrencesQuery(api, `${month}-01`, monthEnd(month)),
  );
  // listOccurrences reads at most 366 days.
  const overdue = useQuery(
    occurrencesQuery(api, shiftDate(today, -365), today, { state: "overdue" }),
  );
  const schedules = useQuery(schedulesQuery(api));
  const accounts = useQuery(accountsQuery(api));
  const settings = useQuery(settingsQuery(api));

  const current = month === today.slice(0, 7);
  const view = agenda(
    occurrences.data ?? [],
    current ? (overdue.data ?? []) : [],
    schedules.data ?? [],
    filter,
  );
  const rows = [...view.overdue, ...view.days.flatMap((d) => d.rows)];
  const currency = settings.data?.base_currency;

  return {
    rows,
    groups: pendingGroups(rows, today),
    close: currency === undefined ? undefined : monthClose(rows, currency),
    series: currency === undefined ? [] : runningBalance(rows, month, currency),
    firstDay: firstDayOfWeek(locale),
    days:
      currency === undefined
        ? []
        : monthDays(rows, month, currency, firstDayOfWeek(locale)),
    currency,
    scale,
    schedules: schedules.data ?? [],
    accounts: accounts.data ?? [],
    loading:
      occurrences.isPending ||
      overdue.isPending ||
      schedules.isPending ||
      scale === null,
    refreshing: occurrences.isFetching && !occurrences.isPending,
  };
}
