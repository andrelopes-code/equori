import { describe, expect, it } from "vitest";

import { recurringAnswer } from "@/features/calculators/recurring-cost-calculator/recurring-answer";

describe("recurringAnswer", () => {
  it("adds the payments without a rate", () => {
    const got = recurringAnswer({
      amount: 5000,
      per: "month",
      years: 1,
      rate: null,
    });

    // 12 payments of 5,000.
    expect(got).toEqual({
      kind: "solved",
      total: 60000,
      futureValue: null,
      difference: null,
    });
  });

  it("states the difference by integer subtraction of the total from the future value", () => {
    const got = recurringAnswer({
      amount: 100000,
      per: "year",
      years: 2,
      rate: 0.1,
    });

    // Two deposits at the start of each year: 100,000 * 1.1^2 + 100,000 * 1.1 = 231,000.
    // Total paid 200,000; difference 31,000.
    expect(got).toEqual({
      kind: "solved",
      total: 200000,
      futureValue: 231000,
      difference: 31000,
    });
  });

  it("gives a zero difference at a zero rate", () => {
    const got = recurringAnswer({
      amount: 5000,
      per: "month",
      years: 1,
      rate: 0,
    });

    expect(got).toEqual({
      kind: "solved",
      total: 60000,
      futureValue: 60000,
      difference: 0,
    });
  });

  it("is missing without an amount or without years", () => {
    expect(
      recurringAnswer({ amount: null, per: "month", years: 1, rate: null }),
    ).toEqual({ kind: "missing" });
    expect(
      recurringAnswer({ amount: 5000, per: "month", years: null, rate: null }),
    ).toEqual({ kind: "missing" });
  });
});
