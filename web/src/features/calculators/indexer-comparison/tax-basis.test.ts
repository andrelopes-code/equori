import { describe, expect, it } from "vitest";

import { fixedIncomeRules } from "@/features/calculators/fixed-income-calculator/fixed-income-region";
import { taxBasis } from "@/features/calculators/indexer-comparison/tax-basis";

describe("taxBasis", () => {
  it("takes the rule of the region", () => {
    expect(taxBasis(fixedIncomeRules("BR"), 731, "")).toBe(1500);
    expect(taxBasis(fixedIncomeRules("BR"), 400, "9")).toBe(1750);
  });

  it("takes the typed rate in a region without rules", () => {
    expect(taxBasis(null, 731, "15")).toBe(1500);
    expect(taxBasis(null, 731, "17.5")).toBe(1750);
  });

  it.each(["", "x", "100", "-1"])("is null for the typed rate %j", (typed) => {
    expect(taxBasis(null, 731, typed)).toBeNull();
  });
});
