import { fixedIncome } from "@/features/calculators/fixed-income-calculator/fixed-income-math";
import {
  horizonMonths,
  type IndexData,
  type Security,
} from "@/features/calculators/indexer-comparison/security";
import { expectedRate } from "@/features/calculators/indexer-comparison/security-rate";

export interface ComparisonRow {
  security: Security;
  annualRate: number;
  gross: number;
  tax: number;
  net: number;
  netAnnualRate: number;
}

// IC1 to IC3: one row per security, in order; null for a security whose rate is unknown.
export function compare(input: {
  amount: number;
  days: number;
  taxBp: number;
  securities: readonly Security[];
  indexes: ReadonlyMap<string, IndexData>;
}): (ComparisonRow | null)[] {
  const { amount, days, taxBp, securities, indexes } = input;
  const months = horizonMonths(days);

  return securities.map((security) => {
    const data =
      security.index === undefined ? undefined : indexes.get(security.index);
    const annualRate = expectedRate(security, data, months);
    if (annualRate === null) return null;

    const result = fixedIncome({
      amount,
      annualRate,
      days,
      taxBp: security.taxed ? taxBp : 0,
    });

    return { security, annualRate, ...result };
  });
}

// IC1: the position of the reference, the first fixed security or else the first.
export function referenceOf(securities: readonly Security[]): number {
  return Math.max(
    0,
    securities.findIndex((s) => s.form === "fixed"),
  );
}
