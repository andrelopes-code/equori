import { describe, expect, it } from "vitest";

import { payoffPlan } from "@/features/calculators/debt-math";
import type { Debt } from "@/features/calculators/debt-math";

const debts: Debt[] = [
  { name: "card", balance: 100000, rate: 0.03, minimum: 5000 },
  { name: "loan", balance: 300000, rate: 0.01, minimum: 10000 },
  { name: "store", balance: 50000, rate: 0.02, minimum: 2500 },
];

describe("payoffPlan", () => {
  it("pays the highest rate first in the avalanche order", () => {
    expect(payoffPlan(debts, 30000, "avalanche")).toEqual({
      months: 17,
      interest: 52780,
      closed: [
        { name: "card", month: 7 },
        { name: "store", month: 9 },
        { name: "loan", month: 17 },
      ],
    });
  });

  it("pays the smallest balance first in the snowball order", () => {
    expect(payoffPlan(debts, 30000, "snowball")).toEqual({
      months: 17,
      interest: 55652,
      closed: [
        { name: "store", month: 4 },
        { name: "card", month: 9 },
        { name: "loan", month: 17 },
      ],
    });
  });

  it("makes no plan below the sum of the minimums", () => {
    expect(payoffPlan(debts, 17000, "avalanche")).toBe("below_minimums");
  });

  it("budget equals interest", () => {
    expect(
      payoffPlan(
        [{ name: "x", balance: 100000, rate: 0.01, minimum: 1000 }],
        1000,
        "avalanche",
      ),
    ).toBe("not_closed");
  });
});
