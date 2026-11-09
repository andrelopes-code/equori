import type { IndicatorMonth, Indicators } from "@/features/overview";

export type Verdict =
  // delta is the absolute difference of the rate and the mean, in basis points.
  | { kind: "above" | "below"; rate: number; mean: number; delta: number }
  | { kind: "inline"; rate: number; mean: number }
  | { kind: "noMean"; rate: number }
  | { kind: "noIncome" }
  | { kind: "partial" };

// Minor units of the report currency; result is income minus expense.
export interface Ledger {
  income: number;
  expense: number;
  result: number;
}

// What the asked month says about the savings rate, against the reader's own 12-month mean (spec
// IT1). An incomplete month says nothing to compare: its rate divides a partial flow by a partial
// flow (spec D3).
export function verdict(report: Indicators, incomplete: boolean): Verdict {
  if (incomplete) return { kind: "partial" };

  const asked = askedMonth(report);
  const rate = asked.savings_rate.bp;

  if (rate === undefined) return { kind: "noIncome" };

  const mean = asked.trailing_savings_rate.bp;

  if (mean === undefined) return { kind: "noMean", rate };

  const delta = rate - mean;

  if (delta === 0) return { kind: "inline", rate, mean };

  return {
    kind: delta > 0 ? "above" : "below",
    rate,
    mean,
    delta: Math.abs(delta),
  };
}

// The money of the asked month. The result is derived here: the payload holds both amounts (spec D5).
export function ledger(report: Indicators): Ledger {
  const asked = askedMonth(report);
  const income = asked.income.amount;
  const expense = asked.expense.amount;

  return { income, expense, result: income - expense };
}

function askedMonth(report: Indicators): IndicatorMonth {
  const asked = report.months.at(-1);

  if (asked === undefined) throw new Error("indicators without months");

  return asked;
}
