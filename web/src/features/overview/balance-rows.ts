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
