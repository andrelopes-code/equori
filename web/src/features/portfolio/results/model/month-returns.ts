import { shiftDate } from "@/i18n/format";
import type { MonthReturn } from "@/ui/month-heat/month-figures";

export type { MonthReturn };

export interface MonthRow {
  year: number;
  cells: (number | null)[];
  total: number;
  accumulated: number;
}

// The month return is the growth of the cumulative return between two consecutive month ends.
export function monthReturns(
  points: readonly { date: string; return_bp?: number }[],
): MonthReturn[] {
  const ends = new Map<string, number>();
  for (const { date, return_bp } of points) {
    if (return_bp === undefined) break;
    ends.set(date.slice(0, 7), return_bp / 10000);
  }

  let previous = 0;

  return [...ends].map(([month, cumulative]) => {
    const value = (1 + cumulative) / (1 + previous) - 1;
    previous = cumulative;

    return { month, value };
  });
}

// The months that lie whole inside [from, to]: a history that starts or ends within a month holds
// part of it only.
export function wholeMonths(
  months: readonly MonthReturn[],
  from: string,
  to: string,
): MonthReturn[] {
  const firstOpen = shiftDate(to, 1).slice(0, 7);

  return months.filter(
    ({ month }) => `${month}-01` >= from && month < firstOpen,
  );
}

// One row per calendar year, newest first.
export function monthRows(months: readonly MonthReturn[]): MonthRow[] {
  const years = [
    ...new Set(months.map((m) => Number(m.month.slice(0, 4)))),
  ].sort();
  let accumulated = 1;

  return years
    .map((year) => {
      const cells = Array<number | null>(12).fill(null);
      let total = 1;
      for (const { month, value } of months) {
        if (Number(month.slice(0, 4)) !== year) continue;

        cells[Number(month.slice(5, 7)) - 1] = value;
        total *= 1 + value;
      }
      accumulated *= total;

      return { year, cells, total: total - 1, accumulated: accumulated - 1 };
    })
    .reverse();
}
