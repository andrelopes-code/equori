import { describe, expect, it } from "vitest";

import { debtAnswer } from "@/features/calculators/debt-payoff-calculator/debt-answer";
import type { Debt } from "@/features/calculators/debt-payoff-calculator/debt-math";

// Two debts, 10% and 1% a month, budget 600.
//
// Avalanche (the 10% debt first):
//   month 1: interest 100 + 5 = 105; minimums 100 + 100; the 400 left go to A. A 600, B 405.
//   month 2: interest 60 + round(4.05) = 64 (169); minimums; 400 to A. A 160, B 309.
//   month 3: interest 16 + round(3.09) = 19 (188); minimums; A pays its last 76, B its 212.
//   Both close in month 3; interest 188.
// Snowball (the smaller balance, B, first):
//   month 1: interest 105; minimums; the 400 left go to B. A 1000, B 5.
//   month 2: interest 100 + 0 (205); A pays 100 and B its last 5, the 495 left go to A. A 505.
//   month 3: interest round(50.5) = 50 by half-even (255); A pays its last 455.
//   B closes in month 2, A in month 3; interest 255.
// The saving is 255 - 188 = 67.
const two: Debt[] = [
  { name: "A", balance: 1000, rate: 0.1, minimum: 100 },
  { name: "B", balance: 500, rate: 0.01, minimum: 100 },
];

// One debt of 1000.00 at 3% a month, budget 300.00, so both orders are the same plan:
//   month 1: 100000 + 3000 - 30000 = 73000
//   month 2: 73000 + 2190 - 30000 = 45190
//   month 3: 45190 + round(1355.7) = 1356, then - 30000 = 16546
//   month 4: 16546 + round(496.38) = 496 = 17042, paid in full.
// Interest 3000 + 2190 + 1356 + 496 = 7042 in 4 months.
const one: Debt[] = [
  { name: "card", balance: 100000, rate: 0.03, minimum: 5000 },
];

describe("debtAnswer", () => {
  it("is missing without a budget or without valid debts", () => {
    expect(debtAnswer(two, null)).toEqual({ kind: "missing" });
    expect(debtAnswer(null, 600)).toEqual({ kind: "missing" });
    expect(debtAnswer([], 600)).toEqual({ kind: "missing" });
  });

  it("stops below the sum of the minimums", () => {
    expect(debtAnswer(two, 199)).toEqual({ kind: "below_minimums" });
  });

  it("names the order with less interest and the saving", () => {
    const got = debtAnswer(two, 600);

    expect(got).toMatchObject({ kind: "solved", cheaper: "avalanche" });
    expect(got).toMatchObject({ saving: 67 });
    expect(got).toMatchObject({
      avalanche: { months: 3, interest: 188 },
      snowball: { months: 3, interest: 255 },
    });
  });

  it("is equal for one debt", () => {
    expect(debtAnswer(one, 30000)).toMatchObject({
      kind: "solved",
      cheaper: "equal",
      saving: 0,
      avalanche: { months: 4, interest: 7042 },
      snowball: { months: 4, interest: 7042 },
    });
  });

  it("is open when a budget equal to the first month's interest never closes the debt", () => {
    // 3% of 100000 is 3000, the whole budget: the balance never falls.
    expect(
      debtAnswer(
        [{ name: "card", balance: 100000, rate: 0.03, minimum: 3000 }],
        3000,
      ),
    ).toEqual({ kind: "open", avalanche: null, snowball: null });
  });
});
