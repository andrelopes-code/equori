import { describe, expect, it } from "vitest";

import {
  prepay,
  priceInstallment,
  priceSchedule,
  sacSchedule,
  solvePrice,
} from "@/features/calculators/annuity";

const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);

describe("annuity", () => {
  it("computes the Price installment (M3)", () => {
    expect(priceInstallment(1000000, 0.01, 12)).toBe(88849);
  });

  it("closes the Price balance with the last installment", () => {
    const rows = priceSchedule(1000000, 0.01, 12);
    expect(rows).toHaveLength(12);
    expect(rows[0]).toEqual({
      month: 1,
      installment: 88849,
      interest: 10000,
      amortization: 78849,
      balance: 921151,
    });
    expect(rows[11]?.installment).toBe(88847);
    expect(rows[11]?.balance).toBe(0);
    expect(sum(rows.map((r) => r.interest))).toBe(66186);
  });

  it("amortizes a constant amount in SAC (M4)", () => {
    const rows = sacSchedule(1200000, 0.01, 12);
    expect(rows[0]?.installment).toBe(112000);
    expect(rows[11]?.installment).toBe(101000);
    expect(rows[11]?.balance).toBe(0);
    expect(sum(rows.map((r) => r.interest))).toBe(78000);
  });

  it("recomputes after a prepayment", () => {
    expect(prepay(1000000, 0.01, 12, 6, 200000)).toEqual({
      balance: 314920,
      keepInstallment: { months: 4, interest: 7420, last: 55793 },
      keepTerm: { installment: 54339, interest: 11113 },
      without: { interest: 18172 },
    });
  });

  it("closes the loan with a prepayment above the balance", () => {
    expect(prepay(1000000, 0.01, 12, 6, 600000)).toEqual({
      balance: 0,
      keepInstallment: { months: 0, interest: 0, last: 0 },
      keepTerm: { installment: 0, interest: 0 },
      without: { interest: 18172 },
    });
  });

  it("zero rate", () => {
    expect(priceInstallment(120000, 0, 12)).toBe(10000);
    expect(sum(priceSchedule(120000, 0, 12).map((r) => r.interest))).toBe(0);
  });

  it("solves the rate of a Price loan", () => {
    const solved = solvePrice({
      amount: 1000000,
      months: 12,
      installment: 88849,
    });
    expect(Math.abs((solved?.rate ?? 0) - 0.01)).toBeLessThan(0.000001);
  });

  it("solves the other three fields", () => {
    expect(
      solvePrice({ rate: 0.01, months: 12, installment: 88849 })?.amount,
    ).toBe(1000002);
    expect(
      solvePrice({ amount: 1000000, rate: 0.01, months: 12 })?.installment,
    ).toBe(88849);
    expect(
      solvePrice({ amount: 1000000, rate: 0.01, installment: 88849 })?.months,
    ).toBe(12);
  });

  it("finds no term when the installment does not cover the interest", () => {
    expect(
      solvePrice({ amount: 1000000, rate: 0.01, installment: 10000 }),
    ).toBeNull();
  });
});
