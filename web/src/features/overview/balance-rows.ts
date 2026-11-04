import type { ForecastDay } from "@/features/overview/forecast";

export interface BalanceRow {
  date: string;
  balance: number | null;
  projection: number | null;
}

// Minor units; a null leaves a gap, so the two lines meet only on today.
export function balanceRows(days: readonly ForecastDay[]): BalanceRow[] {
  return days.map((day) => ({
    date: day.date,
    balance: day.realized ?? null,
    projection: day.forecast ?? null,
  }));
}

// Workaround for Slotted issue #70: the chart's value axis always holds zero, so a balance far
// from zero draws as a flat line. The axis starts a quarter of the balance's span below its
// lowest value, rounded down to the span's order of magnitude, and never below zero; a negative
// or zero balance keeps the chart's own axis.
export function balanceFloor(rows: readonly BalanceRow[]): number | undefined {
  const values = rows.flatMap((row) =>
    [row.balance, row.projection].filter((value) => value !== null),
  );

  if (values.length === 0) return undefined;

  const low = Math.min(...values);
  const high = Math.max(...values);

  if (low < 0 || high === 0) return undefined;

  const span = high > low ? high - low : Math.abs(high) / 10;
  const step = 10 ** Math.floor(Math.log10(span));

  return Math.max(0, Math.floor((low - span / 4) / step) * step);
}
