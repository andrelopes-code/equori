import { describe, expect, it } from "vitest";

import {
  combinedBp,
  equivalentExempt,
  equivalentTaxable,
  fixedIncome,
} from "@/features/calculators/fixed-income-calculator/fixed-income-math";

describe("fixed income math", () => {
  it("takes the tax from the gross yield", () => {
    const got = fixedIncome({
      amount: 1000000,
      annualRate: 0.12,
      days: 400,
      taxBp: 1750,
    });
    expect([got.gross, got.tax, got.net]).toEqual([132238, 23142, 109096]);
    // (1 + 109096 / 1000000)^(365/400) − 1
    expect(got.netAnnualRate).toBeCloseTo(0.099093, 5);
  });

  it("takes the redemption tax, then the tax on what it leaves", () => {
    const got = fixedIncome({
      amount: 1000000,
      annualRate: 0.12,
      days: 20,
      taxBp: 2250,
      redemptionBp: 3300,
    });

    // Spec 2026-11-19 RT2: 33% of 6229, then 22.5% of 4173.
    expect([got.gross, got.redemption, got.tax, got.net]).toEqual([
      6229, 2056, 939, 3234,
    ]);
  });

  it("combines the two shares of the yield", () => {
    expect(combinedBp(2250, 3300)).toBeCloseTo(4807.5, 9);
    expect(combinedBp(1750, 0)).toBe(1750);
  });

  it("converts between exempt and taxable rates", () => {
    expect(Math.abs(equivalentTaxable(0.1, 1750) - 0.121212)).toBeLessThan(
      1e-6,
    );
    expect(Math.abs(equivalentExempt(0.121212, 1750) - 0.1)).toBeLessThan(1e-6);
  });
});
