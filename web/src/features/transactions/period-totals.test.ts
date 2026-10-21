import { describe, expect, it } from "vitest";

import { periodTotals } from "@/features/transactions/period-totals";

const row = (
  amount: number,
  extra: { transfer?: boolean; voided?: boolean; currency?: string } = {},
) => ({
  money: { amount, currency: extra.currency ?? "BRL" },
  transfer: extra.transfer ?? false,
  voided: extra.voided ?? false,
});

describe("periodTotals", () => {
  it("adds money in and money out, leaving transfers and voided entries out", () => {
    expect(
      periodTotals([
        row(10_000),
        row(-2_500),
        row(-1_000),
        row(-9_999, { transfer: true }),
        row(-7_777, { voided: true }),
      ]),
    ).toEqual({ currency: "BRL", income: 10_000, expense: -3_500 });
  });

  it("gives no totals when the rows mix currencies", () => {
    expect(periodTotals([row(100), row(-50, { currency: "USD" })])).toBeNull();
  });

  it("gives no totals without rows", () => {
    expect(periodTotals([])).toBeNull();
  });
});
