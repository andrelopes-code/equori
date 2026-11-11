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

// Debt payments show only for books that hold or pay a debt (analytics design 5.1).
export function showsDebt(month: IndicatorMonth): boolean {
  return month.liabilities.amount > 0 || month.debt_service.amount > 0;
}

// The fewest months with a value that draw a line; two draw only a straight segment.
const seriesFloor = 3;

// The ratio of each month from the first one that has a value, in basis points; a later month
// without one is a gap. Empty below seriesFloor values: months before the first value are not a
// gap of the reader's history, and drawing them leaves the line squeezed at the right edge.
export function indicatorSeries(
  report: Indicators,
  kind: RatioKey,
): (number | null)[] {
  const values = report.months.map((m) => m[kind].bp ?? null);
  const first = values.findIndex((bp) => bp !== null);
  const series = first === -1 ? [] : values.slice(first);

  if (series.filter((bp) => bp !== null).length < seriesFloor) return [];

  return series;
}
