import type { ForecastPoint } from "@/features/forecast";

export interface NetWorthRow {
  date: string;
  // Minor units; a null leaves a gap, so the two lines meet only on today.
  net: number | null;
  forecast: number | null;
  // The likely range around the forecast, when the forecast states one.
  low: number | null;
  high: number | null;
}

// The net worth of each day up to today, then the forecast to the month's end.
export function netWorthRows(
  days: readonly { date: string; net: { amount: number } }[],
  points: readonly ForecastPoint[],
): NetWorthRow[] {
  const forecast = new Map(points.map((point) => [point.date, point]));
  const dates = [
    ...new Set([...days.map((day) => day.date), ...forecast.keys()]),
  ].sort();
  const net = new Map(days.map((day) => [day.date, day.net.amount]));

  return dates.map((date) => ({
    date,
    net: net.get(date) ?? null,
    forecast: forecast.get(date)?.value ?? null,
    low: forecast.get(date)?.low ?? null,
    high: forecast.get(date)?.high ?? null,
  }));
}
