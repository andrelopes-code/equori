import {
  combinedBp,
  equivalentExempt,
  equivalentTaxable,
  fixedIncome,
} from "@/features/calculators/fixed-income-calculator/fixed-income-math";
import type { FixedIncomeRules } from "@/features/calculators/fixed-income-calculator/fixed-income-region";

interface FixedIncomeAnswer {
  // Minor units.
  gross: number;
  redemption: number;
  tax: number;
  net: number;
  netAnnualRate: number;
  // The rate of the other kind of security that leaves the same net.
  equivalent: number;
}

// Basis points of the tax on the yield, from the region's rule or the person's rate; null while
// the days or a valid rate are missing.
export function taxBasisPoints(
  rules: FixedIncomeRules | null,
  days: number | null,
  typedTax: number | null,
): number | null {
  if (days === null) return null;
  if (rules !== null) return rules.taxBp(days);
  if (typedTax === null || typedTax < 0 || typedTax >= 1) return null;

  return Math.round(typedTax * 10000);
}

// Null while an input is missing. An exempt security pays neither tax, and its equivalent is
// the taxed rate that leaves the same net after both (spec 2026-11-19 RT3, RT4).
export function fixedIncomeAnswer(input: {
  amount: number | null;
  annualRate: number | null;
  days: number | null;
  taxBp: number | null;
  redemptionBp: number;
  exempt: boolean;
}): FixedIncomeAnswer | null {
  const { amount, annualRate, days, taxBp, redemptionBp, exempt } = input;
  if (
    amount === null ||
    amount <= 0 ||
    annualRate === null ||
    days === null ||
    taxBp === null
  )
    return null;

  const got = fixedIncome({
    amount,
    annualRate,
    days,
    taxBp: exempt ? 0 : taxBp,
    redemptionBp: exempt ? 0 : redemptionBp,
  });
  const share = combinedBp(taxBp, redemptionBp);

  return {
    ...got,
    equivalent: exempt
      ? equivalentTaxable(annualRate, share)
      : equivalentExempt(annualRate, share),
  };
}
