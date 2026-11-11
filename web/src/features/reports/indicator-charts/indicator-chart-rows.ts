import type { Indicators } from "@/features/overview";
import {
  amountSeries,
  ratioSeries,
} from "@/features/reports/model/indicator-series";

// One record per month for the three charts. A month before the first record has no value in any
// field: a gap, not a zero (spec D4). Amounts are minor units and ratios basis points.
export interface IndicatorChartRow {
  label: string;
  income: number | null;
  expense: number | null;
  liquid: number | null;
  debts: number | null;
  savings: number | null;
  trailing: number | null;
}

export function indicatorChartRows(
  report: Indicators,
  incomplete: boolean,
  label: (month: string) => string,
): IndicatorChartRow[] {
  const income = amountSeries(report, "income");
  const expense = amountSeries(report, "expense");
  const liquid = amountSeries(report, "liquid_balance");
  const debts = amountSeries(report, "liabilities");
  const savings = ratioSeries(report, "savings_rate", incomplete);
  const trailing = ratioSeries(report, "trailing_savings_rate", incomplete);

  return report.months.map((m, i) => ({
    label: label(m.month),
    income: income[i] ?? null,
    expense: expense[i] ?? null,
    liquid: liquid[i] ?? null,
    debts: debts[i] ?? null,
    savings: savings[i] ?? null,
    trailing: trailing[i] ?? null,
  }));
}
