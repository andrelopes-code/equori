import { describe, expect, it } from "vitest";

import { billingPreview } from "@/features/accounts/billing-preview";

describe("billingPreview", () => {
  it.each([
    [
      "a purchase before the closing day",
      {
        effective_from: "2026-01",
        closing_mode: "day",
        closing_day: 5,
        due_day: 12,
      },
      "2026-10-04",
      { reference: "2026-10", closing: "2026-10-05", due: "2026-10-12" },
    ],
    [
      "a purchase on the closing day goes to the next statement",
      {
        effective_from: "2026-01",
        closing_mode: "day",
        closing_day: 5,
        due_day: 12,
        closing_day_assignment: "next",
      },
      "2026-10-05",
      { reference: "2026-11", closing: "2026-11-05", due: "2026-11-12" },
    ],
    [
      "a purchase on the closing day stays when the rule assigns it to the closing statement",
      {
        effective_from: "2026-01",
        closing_mode: "day",
        closing_day: 5,
        due_day: 12,
        closing_day_assignment: "closing",
      },
      "2026-10-05",
      { reference: "2026-10", closing: "2026-10-05", due: "2026-10-12" },
    ],
    [
      "closing a number of days before the due date",
      {
        effective_from: "2026-01",
        closing_mode: "before_due",
        closing_days_before_due: 7,
        due_day: 10,
      },
      "2026-10-01",
      { reference: "2026-10", closing: "2026-10-03", due: "2026-10-10" },
    ],
    [
      "a closing day after the due day closes in the month before",
      {
        effective_from: "2026-01",
        closing_mode: "day",
        closing_day: 25,
        due_day: 5,
      },
      "2026-10-20",
      { reference: "2026-11", closing: "2026-10-25", due: "2026-11-05" },
    ],
    [
      "a due day past the month's end falls on its last day",
      {
        effective_from: "2026-01",
        closing_mode: "day",
        closing_day: 20,
        due_day: 31,
      },
      "2026-10-21",
      { reference: "2026-11", closing: "2026-11-20", due: "2026-11-30" },
    ],
  ] as const)("%s", (_, rule, purchase, want) => {
    expect(billingPreview(rule, purchase)).toEqual(want);
  });
});
