import type { components } from "@/api/schema.gen";
import { changeBp } from "@/features/instruments/model/price-stats";

type Price = components["schemas"]["Price"];

export interface YearChanges {
  year: number;
  // The change of each month in basis points; null without a price, without a price before it and
  // from a price of zero.
  cells: (number | null)[];
  changeBp: number | null;
  // The last price of the year.
  end: Price;
}

// IM2 to IM4: one row per calendar year with a price, newest first. A series inside one month gives
// no row.
export function monthChanges(prices: readonly Price[]): YearChanges[] {
  const sorted = [...prices].sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0];
  const ends = new Map(sorted.map((p) => [p.date.slice(0, 7), p]));
  if (first === undefined || ends.size < 2) return [];

  const rows: YearChanges[] = [];
  let before = first;
  let start = first;

  for (const [month, end] of ends) {
    const year = Number(month.slice(0, 4));
    let row = rows.at(-1);

    if (row?.year !== year) {
      const cells = Array<number | null>(12).fill(null);
      row = { year, cells, changeBp: null, end };
      rows.push(row);
      start = before;
    }

    row.cells[Number(month.slice(5)) - 1] = changeBetween(before, end);
    row.changeBp = changeBetween(start, end);
    row.end = end;
    before = end;
  }

  return rows.reverse();
}

function changeBetween(from: Price, to: Price): number | null {
  return from.date === to.date ? null : changeBp(from.value, to.value);
}
