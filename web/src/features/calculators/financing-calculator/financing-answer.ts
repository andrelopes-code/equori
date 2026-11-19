import { missingSentence } from "@/features/calculators/calculator-frame/missing-fields";
import { prepay } from "@/features/calculators/financing-calculator/annuity";
import type { AmortizationRow } from "@/features/calculators/financing-calculator/annuity";
import { fieldOrder } from "@/features/calculators/financing-calculator/financing-input";
import type { Field } from "@/features/calculators/financing-calculator/financing-input";
import type { TFunction } from "@/i18n/i18n-provider";

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

interface EmptySentenceInput {
  // Every figure is present and valid, yet the loan has no solution.
  complete: boolean;
  missing: Record<Field, boolean>;
  labels: Record<Field, string>;
  // What the answer will show, after "to see".
  what: string;
  noSolution: string;
  t: TFunction;
  tag: string;
}

// The sentence of an answer without a figure: the inputs still missing, in reading order, or why
// the loan has no solution.
export function emptySentence(input: EmptySentenceInput): string {
  if (input.complete) return input.noSolution;

  const fields = fieldOrder.map((field) => ({
    label: input.labels[field].toLocaleLowerCase(input.tag),
    missing: input.missing[field],
  }));

  return missingSentence(fields, input.what, input.t, input.tag) ?? "";
}

interface SplitBarInput {
  amount: number;
  systems: { name: string; interest: number }[];
  format: (minor: number) => string;
  paidLabel: string;
  interestLabel: string;
}

// One bar per system: the amount financed and the interest, the total at the end, and the
// accessible name with both values.
export function splitBarRows(input: SplitBarInput) {
  return input.systems.map((system) => {
    const total = input.format(input.amount + system.interest);
    const interest = input.format(system.interest);

    return {
      name: system.name,
      parts: [input.amount, system.interest] as [number, number],
      total,
      label: `${system.name}: ${input.paidLabel} ${total}, ${input.interestLabel} ${interest}`,
    };
  });
}

function sumOf(
  rows: readonly AmortizationRow[],
  pick: (row: AmortizationRow) => number,
): number {
  return rows.reduce((total, row) => total + pick(row), 0);
}
