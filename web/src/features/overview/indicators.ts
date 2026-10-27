import type { components } from "@/api/schema.gen";

export type Indicators = components["schemas"]["Indicators"];
export type IndicatorMonth = components["schemas"]["IndicatorMonth"];
export type RatioKey =
  | "savings_rate"
  | "trailing_savings_rate"
  | "liquidity"
  | "committed_share"
  | "debt_service_share";

// The month asked: the operation always returns 12 entries, the last one that month.
export function lastMonth(report: Indicators): IndicatorMonth {
  const last = report.months.at(-1);
  if (last === undefined) throw new Error("indicators without months");
  return last;
}

// The ratio of each month, oldest first; null where the month has a reason instead.
export function ratioSeries(
  report: Indicators,
  key: RatioKey,
): (number | null)[] {
  return report.months.map((m) => m[key].bp ?? null);
}

// Debt payments show only for books that hold or pay a debt (analytics design 5.1).
export function showsDebt(month: IndicatorMonth): boolean {
  return month.liabilities.amount > 0 || month.debt_service.amount > 0;
}
