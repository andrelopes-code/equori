import { describe, expect, it } from "vitest";

import { otherIncomeIn } from "@/features/portfolio/projection/model/other-income";

const incomes = [
  { name: "Rent", amount: 200, start_age: 60, end_age: 62 },
  { name: "Pension", amount: 500, start_age: 61 },
];

describe("otherIncomeIn", () => {
  // Born 1964-03-10: 60 in 2024-03, 61 in 2025-03, 62 in 2026-03.
  it.each([
    { month: "2024-02", amount: 0 },
    { month: "2024-03", amount: 200 },
    { month: "2025-02", amount: 200 },
    { month: "2025-03", amount: 700 },
    { month: "2026-02", amount: 700 },
    { month: "2026-03", amount: 500 },
    { month: "2060-01", amount: 500 },
  ])("PX4: is $amount in $month", ({ month, amount }) => {
    expect(otherIncomeIn(incomes, "1964-03-10", month)).toBe(amount);
  });
});
