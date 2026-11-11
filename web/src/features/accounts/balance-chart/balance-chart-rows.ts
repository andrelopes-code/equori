import type { components } from "@/api/schema.gen";
import { shiftDate } from "@/i18n/format";

type Money = components["schemas"]["Money"];

export interface ChartRow {
  date: string;
  balance: number | null;
  projection: number | null;
}

// One row per day: the recorded balance up to today, then the balance the expected entries
// leave, carried from one entry to the next, so the axis keeps one step per day on both sides.
export function balanceChartRows(
  history: readonly { date: string; balance: Money }[],
  projection:
    | { opening: Money; points: readonly { date: string; balance: Money }[] }
    | undefined,
  today: string,
  to: string,
): ChartRow[] {
  const rows: ChartRow[] = history.map((point) => ({
    date: point.date,
    balance: point.balance.amount,
    projection:
      projection !== undefined && point.date === today
        ? point.balance.amount
        : null,
  }));
  if (projection === undefined) return rows;
  let carried = projection.opening.amount;
  let next = 0;
  const points = projection.points;
  for (let day = shiftDate(today, 1); day <= to; day = shiftDate(day, 1)) {
    while (next < points.length && (points[next]?.date ?? "") <= day) {
      carried = points[next]?.balance.amount ?? carried;
      next += 1;
    }
    rows.push({ date: day, balance: null, projection: carried });
  }
  return rows;
}
