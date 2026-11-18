import type { FixedIncomeRules } from "@/features/calculators/fixed-income-calculator/fixed-income-region";
import { readRate } from "@/features/calculators/model/calculator-search";

// The tax on the yield in basis points: the region's rule, or the rate the investor typed in a
// region without rules; null for a typed rate that is not in [0, 100).
export function taxBasis(
  rules: FixedIncomeRules | null,
  days: number,
  typed: string,
): number | null {
  if (rules !== null) return rules.taxBp(days);

  const rate = readRate(typed === "" ? undefined : typed);

  return rate === null || rate < 0 || rate >= 1
    ? null
    : Math.round(rate * 10000);
}
