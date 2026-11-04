import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import { recurringShares } from "@/features/planning/recurring-share";

type Schedule = components["schemas"]["Schedule"];

const today = "2026-10-30";

function schedule(
  kind: Schedule["kind"],
  amount: number,
  currency: string,
  over: Partial<Schedule> = {},
): Schedule {
  return {
    kind,
    terms: [
      {
        effective_from: "2026-01-01",
        amount: { amount, currency },
        recurrence: {
          frequency: "monthly",
          interval: 1,
          adjustment: "none",
          start: "2026-01-01",
        },
      },
    ],
    ...over,
  } as Schedule;
}

describe("recurringShares", () => {
  it("divides the yearly bills and subscriptions by the yearly income, in basis points", () => {
    const shares = recurringShares(
      [
        schedule("income", 500000, "BRL"),
        schedule("bill", 210000, "BRL"),
        schedule("subscription", 4000, "BRL"),
        schedule("transfer", 999999, "BRL"),
        schedule("savings", 999999, "BRL"),
      ],
      today,
    );

    expect(shares).toEqual([{ currency: "BRL", basisPoints: 4280 }]);
  });

  it("leaves out an ended schedule and a currency without income", () => {
    const shares = recurringShares(
      [
        schedule("income", 100000, "BRL"),
        schedule("bill", 10000, "BRL"),
        schedule("bill", 90000, "BRL", { ends_on: "2026-10-29" }),
        schedule("bill", 5000, "USD"),
      ],
      today,
    );

    expect(shares).toEqual([{ currency: "BRL", basisPoints: 1000 }]);
  });

  it("leaves out a schedule that ends today, which produces no occurrence from today", () => {
    const shares = recurringShares(
      [
        schedule("income", 100000, "BRL"),
        schedule("income", 100000, "BRL", { ends_on: today }),
        schedule("bill", 10000, "BRL"),
      ],
      today,
    );

    expect(shares).toEqual([{ currency: "BRL", basisPoints: 1000 }]);
  });
});
