import { describe, expect, it } from "vitest";

import {
  balances,
  depositForTarget,
  depositsValue,
  futureValue,
  incomeEvolution,
  monthlyIncome,
  splitIncome,
  yearlyIncome,
} from "@/features/calculators/model/compound-math";

describe("compound math", () => {
  it("grows a capital (M1)", () => {
    expect(futureValue(100000, 0.01, 12)).toBe(112683);
  });

  it("grows deposits made at the start of each month (M2)", () => {
    expect(depositsValue(10000, 0.005, 12)).toBe(123972);
  });

  it("zero rate", () => {
    expect(depositsValue(10000, 0, 12)).toBe(120000);
    expect(futureValue(100000, 0, 12)).toBe(100000);
  });

  it("finds the deposit that reaches a target", () => {
    expect(depositForTarget(123972, 0, 0.005, 12)).toBe(10000);
    expect(depositForTarget(120000, 0, 0, 12)).toBe(10000);
  });

  it("needs no deposit when the capital alone reaches the target", () => {
    expect(depositForTarget(100000, 100000, 0.01, 12)).toBe(0);
  });

  it("lists the balance and the deposits of each month", () => {
    const rows = balances(100000, 10000, 0.01, 12);
    expect(rows).toHaveLength(12);
    const last = rows[11];
    expect(last?.month).toBe(12);
    expect(last?.deposited).toBe(220000);
    expect(
      Math.abs(
        (last?.balance ?? 0) -
          (futureValue(100000, 0.01, 12) + depositsValue(10000, 0.01, 12)),
      ),
    ).toBeLessThanOrEqual(12);
  });

  it("pays the income that keeps a balance's purchasing power", () => {
    // 1% a month against 0.5% of inflation: the balance must grow 0.5% a month.
    expect(monthlyIncome(1_000_000, 0.01, 0.005)).toBe(5000);
    expect(monthlyIncome(1_000_000, 0.01, 0)).toBe(10000);
  });

  it("pays no lasting income when inflation reaches the rate", () => {
    expect(monthlyIncome(1_000_000, 0.004, 0.005)).toBeNull();
    expect(monthlyIncome(1_000_000, 0.005, 0.005)).toBeNull();
  });

  it("spends the balance over a term with an income that follows inflation", () => {
    // F (j − g) / (1 − ((1 + g) / (1 + j))^n).
    expect(monthlyIncome(1_000_000, 0.01, 0.005, 360)).toBe(6006);
    // j = g: F (1 + j) / n.
    expect(monthlyIncome(1_000_000, 0.01, 0.01, 120)).toBe(8417);
  });

  it("sets aside a quarter of the income and leaves the rest to live on", () => {
    expect(splitIncome(752022)).toEqual({ reinvested: 188006, living: 564016 });
  });

  it("keeps the two parts equal to the income when the quarter is a half cent", () => {
    // 1127 / 4 = 281.75 minor units: the reinvested part rounds half to even.
    expect(splitIncome(1127)).toEqual({ reinvested: 282, living: 845 });
  });

  it("reinvests a share of each month's income and lives on the rest", () => {
    // 1 000 000.00 at 1.0979% a month: income 10 979.00, reinvested 25% = 2 744.75.
    const rows = incomeEvolution(100_000_000, 0.010979, 0.25, 2);

    expect(rows[0]).toEqual({
      month: 1,
      opening: 100_000_000,
      income: 1_097_900,
      reinvested: 274_475,
      living: 823_425,
      closing: 100_274_475,
    });
    // The second month earns on the opening balance plus the reinvested part.
    expect(rows[1]?.opening).toBe(100_274_475);
    expect(rows[1]?.income).toBe(1_100_913);
  });

  it("keeps the balance when the whole income is lived on", () => {
    const rows = incomeEvolution(100_000_000, 0.01, 0, 3);

    expect(rows.map((r) => r.closing)).toEqual([
      100_000_000, 100_000_000, 100_000_000,
    ]);
    expect(rows.map((r) => r.living)).toEqual([
      1_000_000, 1_000_000, 1_000_000,
    ]);
  });

  it("sums the months of each year", () => {
    const rows = incomeEvolution(100_000_000, 0.01, 0.5, 14);
    const years = yearlyIncome(rows);

    expect(years).toHaveLength(2);
    expect(years[0]).toMatchObject({
      year: 1,
      opening: 100_000_000,
      closing: rows[11]?.closing,
    });
    expect(years[0]?.living).toBe(
      rows.slice(0, 12).reduce((s, r) => s + r.living, 0),
    );
    expect(years[1]).toMatchObject({
      year: 2,
      opening: rows[11]?.closing,
      closing: rows[13]?.closing,
    });
  });
});
