import type { components } from "@/api/schema.gen";
import type { MonthReturn } from "@/features/portfolio/results/model/month-returns";

type SeriesPoint = components["schemas"]["ReturnSeriesPoint"];
type IndexPoint = components["schemas"]["ReturnSeriesIndexPoint"];

const monthsPerYear = 12;
const daysPerYear = 365;

// The lowest level over its running maximum, with the dates of the peak and of the trough.
export function largestFall(
  points: readonly { date: string; return_bp?: number }[],
): { value: number; from: string; to: string } | null {
  let peak: { level: number; date: string } | undefined;
  let fall: { value: number; from: string; to: string } | null = null;

  for (const { date, return_bp } of points) {
    if (return_bp === undefined) continue;

    const level = 1 + return_bp / 10000;
    if (peak === undefined || level > peak.level) peak = { level, date };

    const value = level / peak.level - 1;
    if (value < (fall?.value ?? 0)) fall = { value, from: peak.date, to: date };
  }

  return fall;
}

// The sample deviation of the month returns, annualized by the root of 12 (PR6).
export function volatility(months: readonly MonthReturn[]): number | null {
  if (months.length < monthsPerYear) return null;

  const mean = months.reduce((sum, m) => sum + m.value, 0) / months.length;
  const variance =
    months.reduce((sum, m) => sum + (m.value - mean) ** 2, 0) /
    (months.length - 1);

  return Math.sqrt(variance * monthsPerYear);
}

export function annualRate(total: number, days: number): number | null {
  if (days < daysPerYear) return null;

  return (1 + total) ** (daysPerYear / days) - 1;
}

export function pointsApart(
  portfolio: readonly SeriesPoint[],
  index: readonly IndexPoint[],
): number | null {
  const shared = lastShared(portfolio, index);

  return shared === null ? null : shared.portfolio - shared.index;
}

export function realReturn(
  portfolio: readonly SeriesPoint[],
  inflation: readonly IndexPoint[],
): { value: number; until: string } | null {
  const shared = lastShared(portfolio, inflation);
  if (shared === null) return null;

  return {
    value: (1 + shared.portfolio) / (1 + shared.index) - 1,
    until: shared.date,
  };
}

// The cumulative returns of both series on the last date both hold.
function lastShared(
  portfolio: readonly SeriesPoint[],
  index: readonly IndexPoint[],
): { date: string; portfolio: number; index: number } | null {
  const held = new Map<string, number>();
  for (const { date, return_bp } of portfolio) {
    if (return_bp !== undefined) held.set(date, return_bp);
  }

  const shared = index
    .filter((p) => held.has(p.date))
    .reduce<IndexPoint | undefined>(
      (last, p) => (last === undefined || p.date > last.date ? p : last),
      undefined,
    );
  if (shared === undefined) return null;

  return {
    date: shared.date,
    portfolio: (held.get(shared.date) ?? 0) / 10000,
    index: shared.return_bp / 10000,
  };
}
