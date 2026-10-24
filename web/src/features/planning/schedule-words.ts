import type { components } from "@/api/schema.gen";
import type { MessageKey } from "@/i18n/catalog.en";
import { formatDate, formatDayMonthLong } from "@/i18n/format";
import type { TFunction } from "@/i18n/i18n-provider";

type OccurrenceState = components["schemas"]["OccurrenceState"];

export const kindLabel: Record<
  components["schemas"]["ScheduleKind"],
  MessageKey
> = {
  bill: "scheduled.kind.bill",
  income: "scheduled.kind.income",
  subscription: "scheduled.kind.subscription",
  transfer: "scheduled.kind.transfer",
  savings: "scheduled.kind.savings",
};

export const stateTone: Record<
  OccurrenceState,
  "info" | "danger" | "success" | "secondary"
> = {
  expected: "info",
  overdue: "danger",
  realized: "success",
  skipped: "secondary",
};

type Recurrence = components["schemas"]["Recurrence"];
type ScheduleTerms = components["schemas"]["ScheduleTerms"];

const every: Record<Recurrence["frequency"], [MessageKey, MessageKey]> = {
  daily: ["recurrence.daily", "recurrence.dailyMany"],
  weekly: ["recurrence.weekly", "recurrence.weeklyMany"],
  monthly: ["recurrence.monthly", "recurrence.monthlyMany"],
  yearly: ["recurrence.yearly", "recurrence.yearlyMany"],
};

const ordinals: Record<string, MessageKey> = {
  "1": "recurrence.ordinal.1",
  "2": "recurrence.ordinal.2",
  "3": "recurrence.ordinal.3",
  "4": "recurrence.ordinal.4",
  "5": "recurrence.ordinal.5",
  "-1": "recurrence.ordinal.last",
};

const adjustments: Record<Recurrence["adjustment"], MessageKey | undefined> = {
  none: undefined,
  following: "recurrence.adjust.following",
  preceding: "recurrence.adjust.preceding",
  modified_following: "recurrence.adjust.modifiedFollowing",
};

export const weekdays = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

// The weekday's name in the locale: 2023-01-01 was a Sunday.
export function weekdayName(
  weekday: (typeof weekdays)[number],
  locale: string,
): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2023, 0, 1 + weekdays.indexOf(weekday))));
}

// The rule in the reader's words, from its frequency to its end.
export function recurrenceWords(
  r: Recurrence,
  t: TFunction,
  locale: string,
): string {
  const [one, many] = every[r.frequency];
  const parts = [r.interval === 1 ? t(one) : t(many, { count: r.interval })];
  if (r.day_of_month !== undefined)
    parts.push(
      r.day_of_month === -1
        ? t("recurrence.onLastDay")
        : t("recurrence.onDay", { day: r.day_of_month }),
    );
  else if (r.business_day_ordinal !== undefined)
    parts.push(
      r.business_day_ordinal === -1
        ? t("recurrence.onLastBusinessDay")
        : t("recurrence.onBusinessDay", { day: r.business_day_ordinal }),
    );
  else if (r.weekday !== undefined) {
    const weekday = weekdayName(r.weekday, locale);
    const ordinal =
      r.ordinal === undefined ? undefined : ordinals[String(r.ordinal)];
    parts.push(
      ordinal === undefined
        ? t("recurrence.onWeekday", { weekday })
        : t("recurrence.onOrdinalWeekday", { ordinal: t(ordinal), weekday }),
    );
  } else if (r.frequency === "yearly")
    parts.push(
      t("recurrence.onDate", { date: formatDayMonthLong(r.start, locale) }),
    );
  const adjust = adjustments[r.adjustment];
  if (adjust !== undefined) parts.push(t(adjust));
  parts.push(t("recurrence.from", { date: formatDate(r.start, locale) }));
  if (r.until !== undefined)
    parts.push(t("recurrence.until", { date: formatDate(r.until, locale) }));
  if (r.count !== undefined)
    parts.push(t("recurrence.count", { count: r.count }));
  return parts.join(", ");
}

// The terms in force on a date; before the first version, the first one.
export function currentTerms(
  terms: readonly ScheduleTerms[],
  date: string,
): ScheduleTerms | undefined {
  return terms.filter((v) => v.effective_from <= date).at(-1) ?? terms[0];
}

// Occurrences in a year of each frequency at interval 1; a week counts 52 times.
const perYear: Record<Recurrence["frequency"], number> = {
  daily: 365,
  weekly: 52,
  monthly: 12,
  yearly: 1,
};

// What a subscription costs a month and a year, in minor units of its amount.
export function subscriptionCost(
  r: Recurrence,
  amount: number,
): { monthly: number; yearly: number } {
  const yearly = Math.round((amount * perYear[r.frequency]) / r.interval);
  return { monthly: Math.round(yearly / 12), yearly };
}
