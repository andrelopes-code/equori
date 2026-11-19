import { prepay } from "@/features/calculators/financing-calculator/annuity";
import type { AmortizationRow } from "@/features/calculators/financing-calculator/annuity";

interface PrepayInput {
  amount: number;
  // A monthly rate as a fraction.
  rate: number;
  months: number;
  // The prepayment falls right after this installment.
  month: number;
  extra: number;
}

interface PrepayChoices {
  keepInstallment: { months: number; fewer: number; saved: number };
  keepTerm: { installment: number; saved: number };
}

// Amounts are minor units; every figure is an integer subtraction of a schedule's results.
export function financingFacts(
  price: readonly AmortizationRow[],
  sac: readonly AmortizationRow[],
): { paid: number; interest: number; saved: number } {
  const interest = sumOf(price, (row) => row.interest);

  return {
    paid: sumOf(price, (row) => row.installment),
    interest,
    saved: interest - sumOf(sac, (row) => row.interest),
  };
}

// What a prepayment saves in each of its two uses; null for a month outside 1 to the term minus one.
export function prepayChoices(input: PrepayInput): PrepayChoices | null {
  const change = prepay(
    input.amount,
    input.rate,
    input.months,
    input.month,
    input.extra,
  );
  if (change === null) return null;

  return {
    keepInstallment: {
      months: change.keepInstallment.months,
      fewer: input.months - input.month - change.keepInstallment.months,
      saved: change.without.interest - change.keepInstallment.interest,
    },
    keepTerm: {
      installment: change.keepTerm.installment,
      saved: change.without.interest - change.keepTerm.interest,
    },
  };
}

function sumOf(
  rows: readonly AmortizationRow[],
  pick: (row: AmortizationRow) => number,
): number {
  return rows.reduce((total, row) => total + pick(row), 0);
}
