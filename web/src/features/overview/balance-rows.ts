import type { ForecastDay } from "@/features/overview/forecast";
import { axisFloor } from "@/ui/axis-floor";

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

// The axis of the balance chart fits the balance and the forecast (Slotted issue #70, axisFloor).
export function balanceFloor(rows: readonly BalanceRow[]): number | undefined {
  return axisFloor(
    rows.flatMap((row) =>
      [row.balance, row.projection].filter((value) => value !== null),
    ),
  );
}
