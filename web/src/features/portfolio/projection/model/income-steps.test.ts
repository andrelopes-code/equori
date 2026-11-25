import { describe, expect, it } from "vitest";

import { incomeSteps } from "@/features/portfolio/projection/model/income-steps";

const incomes = [
  { name: "Rent", amount: 200, start_age: 50, end_age: 62 },
  { name: "Pension", amount: 500, start_age: 65 },
];

describe("incomeSteps", () => {
  it("PX21: states the total of each range of ages of the withdrawals", () => {
    expect(
      incomeSteps({ incomes, from: 60, to: 90, portfolio: 1000, endAge: null }),
    ).toEqual([
      { from: 60, to: 62, total: 1200 },
      { from: 62, to: 65, total: 1000 },
      { from: 65, to: 90, total: 1500 },
    ]);
  });

  it("PX21: leaves the portfolio out from the age its value ends", () => {
    expect(
      incomeSteps({ incomes, from: 60, to: 90, portfolio: 1000, endAge: 70 }),
    ).toEqual([
      { from: 60, to: 62, total: 1200 },
      { from: 62, to: 65, total: 1000 },
      { from: 65, to: 70, total: 1500 },
      { from: 70, to: 90, total: 500 },
    ]);
  });

  it("PX21: an age outside the withdrawals makes no range", () => {
    expect(
      incomeSteps({
        incomes: [{ name: "Rent", amount: 1, start_age: 91 }],
        from: 60,
        to: 90,
        portfolio: 1000,
        endAge: null,
      }),
    ).toEqual([{ from: 60, to: 90, total: 1000 }]);
  });
});
