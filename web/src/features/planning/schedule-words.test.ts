import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import {
  currentTerms,
  recurrenceWords,
  subscriptionCost,
} from "@/features/planning/schedule-words";
import { catalogEn } from "@/i18n/catalog.en";
import type { MessageKey } from "@/i18n/catalog.en";

type Recurrence = components["schemas"]["Recurrence"];

const t = (key: MessageKey, vars: Record<string, string | number> = {}) =>
  catalogEn[key].replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name]));

const words = (r: Recurrence) => recurrenceWords(r, t, "en-US");

describe("recurrenceWords", () => {
  it.each<[string, Recurrence, string]>([
    [
      "S27 rent",
      {
        frequency: "monthly",
        interval: 1,
        day_of_month: 5,
        adjustment: "following",
        start: "2026-11-05",
      },
      "Every month, on day 5, moved to the next business day, from 11/05/2026",
    ],
    [
      "S28 day 31",
      {
        frequency: "monthly",
        interval: 1,
        day_of_month: -1,
        adjustment: "none",
        start: "2027-01-31",
      },
      "Every month, on the last day, from 01/31/2027",
    ],
    [
      "S62 salary",
      {
        frequency: "monthly",
        interval: 1,
        business_day_ordinal: 5,
        adjustment: "none",
        start: "2026-11-01",
        count: 12,
      },
      "Every month, on business day 5, from 11/01/2026, 12 times",
    ],
    [
      "weekday with ordinal",
      {
        frequency: "monthly",
        interval: 2,
        weekday: "monday",
        ordinal: -1,
        adjustment: "none",
        start: "2026-11-01",
        until: "2027-12-31",
      },
      "Every 2 months, on the last Monday, from 11/01/2026, until 12/31/2027",
    ],
    [
      "weekly",
      {
        frequency: "weekly",
        interval: 1,
        weekday: "friday",
        adjustment: "none",
        start: "2026-11-06",
      },
      "Every week, on Friday, from 11/06/2026",
    ],
    [
      "yearly",
      {
        frequency: "yearly",
        interval: 1,
        adjustment: "none",
        start: "2027-03-10",
      },
      "Every year, on March 10, from 03/10/2027",
    ],
  ])("states %s", (_, recurrence, expected) => {
    expect(words(recurrence)).toBe(expected);
  });
});

describe("currentTerms", () => {
  const terms = [
    {
      effective_from: "2026-11-12",
      amount: { amount: 3990, currency: "BRL" },
      recurrence: {
        frequency: "monthly",
        interval: 1,
        adjustment: "none",
        start: "2026-11-12",
      },
    },
    {
      effective_from: "2027-01-01",
      amount: { amount: 4490, currency: "BRL" },
      recurrence: {
        frequency: "monthly",
        interval: 1,
        adjustment: "none",
        start: "2026-11-12",
      },
    },
  ] satisfies components["schemas"]["ScheduleTerms"][];

  it("takes the latest version in force on the date, or the first before any", () => {
    expect(currentTerms(terms, "2026-12-31")?.amount.amount).toBe(3990);
    expect(currentTerms(terms, "2027-01-01")?.amount.amount).toBe(4490);
    expect(currentTerms(terms, "2026-01-01")?.amount.amount).toBe(3990);
    expect(currentTerms([], "2026-01-01")).toBeUndefined();
  });
});

describe("subscriptionCost", () => {
  const rule = (
    frequency: Recurrence["frequency"],
    interval = 1,
  ): Recurrence => ({
    frequency,
    interval,
    adjustment: "none",
    start: "2026-01-01",
  });

  it.each<[string, Recurrence, number, { monthly: number; yearly: number }]>([
    ["monthly (S29)", rule("monthly"), 4490, { monthly: 4490, yearly: 53880 }],
    [
      "every two months",
      rule("monthly", 2),
      3000,
      { monthly: 1500, yearly: 18000 },
    ],
    ["weekly", rule("weekly"), 1000, { monthly: 4333, yearly: 52000 }],
    ["yearly", rule("yearly"), 12000, { monthly: 1000, yearly: 12000 }],
    ["daily", rule("daily"), 100, { monthly: 3042, yearly: 36500 }],
  ])("costs a %s subscription per month and per year", (_, r, amount, cost) => {
    expect(subscriptionCost(r, amount)).toEqual(cost);
  });
});
