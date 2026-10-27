import { describe, expect, it } from "vitest";

import { depositsValue } from "@/features/calculators/compound-math";
import { ownershipCost, recurringCost } from "@/features/calculators/plan-math";
import { annualToMonthly } from "@/features/calculators/rate-math";

describe("recurringCost", () => {
  it("adds the occurrences without a rate", () => {
    expect(recurringCost(5000, 12, 1, null)).toEqual({
      total: 60000,
      futureValue: null,
    });
  });

  it("grows the payments as deposits at the start of each period (M2)", () => {
    expect(recurringCost(5000, 12, 1, 0).futureValue).toBe(60000);
    expect(recurringCost(5000, 12, 1, 0.12).futureValue).toBe(
      depositsValue(5000, annualToMonthly(0.12), 12),
    );
    expect(recurringCost(100000, 1, 2, 0.1).futureValue).toBe(
      depositsValue(100000, 0.1, 2),
    );
  });
});

describe("ownershipCost", () => {
  it("adds the six components of the annual cost of owning", () => {
    const got = ownershipCost({
      price: 50000000,
      riskFree: 0.1,
      propertyTax: 0.01,
      deductibleTax: 0,
      mortgage: 0.11,
      maintenance: 0.015,
      appreciation: 0.04,
      riskPremium: 0.02,
    });
    expect(got.total).toBe(5250000);
    expect(got.components).toEqual({
      forgone: 5000000,
      propertyTax: 500000,
      deduction: 0,
      maintenance: 750000,
      appreciation: -2000000,
      riskPremium: 1000000,
    });
  });
});
