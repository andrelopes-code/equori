import type { OtherIncome } from "@/features/portfolio/projection/model/other-income";

export interface IncomeStep {
  from: number;
  to: number;
  total: number;
}

interface IncomeStepsInput {
  incomes: readonly OtherIncome[];
  // The ages of the first withdrawal and of the last one.
  from: number;
  to: number;
  // The monthly income of the portfolio, paid until `endAge` when its value ends.
  portfolio: number;
  endAge: number | null;
}

// PX21: the total income per range of ages, a range starting where an income starts or ends.
export function incomeSteps({
  incomes,
  from,
  to,
  portfolio,
  endAge,
}: IncomeStepsInput): IncomeStep[] {
  const ages = incomes.flatMap((i) => [i.start_age, i.end_age ?? to]);
  const inside = [...ages, endAge ?? to].filter((a) => a > from && a < to);
  const starts = [...new Set([from, ...inside])].sort((a, b) => a - b);

  return starts.map((age, i) => ({
    from: age,
    to: starts[i + 1] ?? to,
    total:
      (age < (endAge ?? Infinity) ? portfolio : 0) +
      incomes
        .filter((o) => o.start_age <= age && age < (o.end_age ?? Infinity))
        .reduce((sum, o) => sum + o.amount, 0),
  }));
}
