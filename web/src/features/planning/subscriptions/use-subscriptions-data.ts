import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { accountsQuery } from "@/features/accounts";
import { occurrencesQuery, schedulesQuery } from "@/features/planning/api";
import {
  subscriptionFigures,
  windowStart,
} from "@/features/planning/subscriptions/subscription-figures";
import { settingsQuery, useScale } from "@/features/setup";
import { shiftDate } from "@/i18n/format";
import { useToday } from "@/i18n/today";

// How far ahead the next charges are read.
const aheadDays = 60;

// The subscriptions and what the tab derives from them (spec 6): the occurrences of the last 12
// months for the cells and the charged total, the expected ones ahead for the next charges.
export function useSubscriptionsData() {
  const api = useApi();
  const today = useToday();
  const scale = useScale();
  const schedules = useQuery(schedulesQuery(api));
  const accounts = useQuery(accountsQuery(api));
  const settings = useQuery(settingsQuery(api));
  const past = useQuery(occurrencesQuery(api, windowStart(today), today));
  const upcoming = useQuery(
    occurrencesQuery(api, today, shiftDate(today, aheadDays), {
      state: "expected",
    }),
  );

  const currency = settings.data?.base_currency;

  return {
    schedules,
    scale,
    accountNames: new Map((accounts.data ?? []).map((a) => [a.id, a.name])),
    figures:
      currency === undefined
        ? undefined
        : subscriptionFigures({
            schedules: schedules.data ?? [],
            past: past.data ?? [],
            upcoming: upcoming.data ?? [],
            today,
            currency,
          }),
    loading: schedules.isPending || past.isPending || scale === null,
  };
}
