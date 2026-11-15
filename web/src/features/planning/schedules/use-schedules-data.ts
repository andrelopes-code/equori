import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { accountsQuery } from "@/features/accounts";
import { occurrencesQuery, schedulesQuery } from "@/features/planning/api";
import {
  currentTerms,
  hasEnded,
  subscriptionCost,
} from "@/features/planning/model/schedule-words";
import { commitments } from "@/features/planning/schedules/commitments";
import { settingsQuery, useScale } from "@/features/setup";
import { shiftDate } from "@/i18n/format";
import { useToday } from "@/i18n/today";

type Schedule = components["schemas"]["Schedule"];
type ScheduleKind = components["schemas"]["ScheduleKind"];

export interface KindGroup {
  kind: ScheduleKind;
  schedules: Schedule[];
  // Monthly cost of the base-currency schedules of the kind.
  monthly: number;
}

// Section order of spec B3.
const kinds: readonly ScheduleKind[] = [
  "bill",
  "subscription",
  "savings",
  "transfer",
  "income",
];

// The schedules of the tab, grouped by kind with the highest monthly cost first, the ended
// ones by the latest end first, and the next expected occurrence of each (spec 5).
export function useSchedulesData() {
  const api = useApi();
  const today = useToday();
  const scale = useScale();
  const schedules = useQuery(schedulesQuery(api));
  const accounts = useQuery(accountsQuery(api));
  const settings = useQuery(settingsQuery(api));
  // listOccurrences reads at most 366 days.
  const upcoming = useQuery(
    occurrencesQuery(api, today, shiftDate(today, 365), { state: "expected" }),
  );

  const items = schedules.data ?? [];
  const currency = settings.data?.base_currency;
  const monthly = (s: Schedule) => {
    const terms = currentTerms(s.terms, today);
    return terms === undefined
      ? 0
      : subscriptionCost(terms.recurrence, terms.amount.amount).monthly;
  };
  const active = items.filter((s) => !hasEnded(s.ends_on, today));
  const nextOn = new Map<string, string>();
  for (const o of upcoming.data ?? [])
    if (o.state === "expected" && !nextOn.has(o.schedule_id))
      nextOn.set(o.schedule_id, o.expected_on);

  return {
    schedules,
    scale,
    currency,
    accountNames: new Map((accounts.data ?? []).map((a) => [a.id, a.name])),
    nextOn,
    commitments:
      currency === undefined ? undefined : commitments(items, today, currency),
    groups: kinds
      .map((kind) => {
        const rows = active
          .filter((s) => s.kind === kind)
          .sort((a, b) => monthly(b) - monthly(a));
        const own = rows.filter(
          (s) => currentTerms(s.terms, today)?.amount.currency === currency,
        );
        return {
          kind,
          schedules: rows,
          monthly: own.reduce((sum, s) => sum + monthly(s), 0),
        };
      })
      .filter((g) => g.schedules.length > 0) satisfies KindGroup[],
    ended: items
      .filter((s) => hasEnded(s.ends_on, today))
      .sort((x, y) => (y.ends_on ?? "").localeCompare(x.ends_on ?? "")),
  };
}
