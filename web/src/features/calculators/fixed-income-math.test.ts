import { describe, expect, it } from "vitest";

import {
  equivalentExempt,
  equivalentTaxable,
  fixedIncome,
} from "@/features/calculators/fixed-income-math";

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

  it("converts between exempt and taxable rates", () => {
    expect(Math.abs(equivalentTaxable(0.1, 1750) - 0.121212)).toBeLessThan(
      1e-6,
    );
    expect(Math.abs(equivalentExempt(0.121212, 1750) - 0.1)).toBeLessThan(1e-6);
  });
});
