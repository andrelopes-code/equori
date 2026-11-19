import { describe, expect, it } from "vitest";

import { cashAnswer } from "@/features/calculators/cash-or-installments-calculator/cash-answer";

describe("cashAnswer", () => {
  const base = { cash: 100000, count: 10, installment: 11000, firstNow: false };

  const cases = [
    {
      name: "installments worth more than the cash price: cash is cheaper",
      input: { ...base, compareMonthly: 0.01 },
      want: { cheaper: "cash", difference: 4184, total: 110000 },
    },
    {
      name: "installments worth less than the cash price: installments are cheaper",
      input: { ...base, installment: 10100, compareMonthly: 0.05 },
      want: { cheaper: "installments", difference: 22010, total: 101000 },
    },
    {
      name: "one installment paid now equals the cash price at any rate",
      input: {
        cash: 100000,
        count: 1,
        installment: 100000,
        firstNow: true,
        compareMonthly: 0.02,
      },
      want: { cheaper: "equal", difference: 0, total: 100000 },
    },
  ] as const;

  it.each(cases)("$name", ({ input, want }) => {
    const got = cashAnswer(input);

    expect(got?.comparison?.cheaper).toBe(want.cheaper);
    expect(got?.comparison?.difference).toBe(want.difference);
    expect(got?.total).toBe(want.total);
  });

  it("has no comparison without a comparison rate", () => {
    const got = cashAnswer({ ...base, compareMonthly: null });

    expect(got?.comparison).toBeNull();
    expect(typeof got?.implied).toBe("number");
  });

  it("is null while an input is missing", () => {
    expect(
      cashAnswer({ ...base, cash: null, compareMonthly: 0.01 }),
    ).toBeNull();
    expect(cashAnswer({ ...base, cash: 0, compareMonthly: 0.01 })).toBeNull();
    expect(
      cashAnswer({ ...base, count: null, compareMonthly: 0.01 }),
    ).toBeNull();
    expect(
      cashAnswer({ ...base, installment: null, compareMonthly: 0.01 }),
    ).toBeNull();
  });

  it("states no interest and no solution", () => {
    expect(
      cashAnswer({ ...base, installment: 10000, compareMonthly: null })
        ?.implied,
    ).toBe("no_interest");
    expect(
      cashAnswer({
        ...base,
        count: 2,
        installment: 10000000,
        compareMonthly: null,
      })?.implied,
    ).toBeNull();
  });
});
