import { describe, expect, it } from "vitest";

import { fillableSchedules } from "@/features/calculators/recurring-cost-calculator/fillable-schedules";

const terms = (
  amount: number,
  currency: string,
  frequency: string,
  interval = 1,
) => ({ amount: { amount, currency }, recurrence: { frequency, interval } });

describe("fillableSchedules", () => {
  it("keeps the schedules that recur every month or year in the currency, by the latest terms", () => {
    const got = fillableSchedules(
      [
        {
          id: "a",
          description: "Rent",
          terms: [terms(-210000, "BRL", "monthly")],
        },
        {
          id: "b",
          description: "Insurance",
          terms: [terms(1, "BRL", "monthly"), terms(90000, "BRL", "yearly")],
        },
        {
          id: "c",
          description: "Weekly",
          terms: [terms(100, "BRL", "weekly")],
        },
        {
          id: "d",
          description: "Dollars",
          terms: [terms(100, "USD", "monthly")],
        },
        {
          id: "e",
          description: "Every two months",
          terms: [terms(100, "BRL", "monthly", 2)],
        },
      ],
      "BRL",
    );

    expect(got).toEqual([
      { id: "a", name: "Rent", amount: 210000, per: "month" },
      { id: "b", name: "Insurance", amount: 90000, per: "year" },
    ]);
  });
});
