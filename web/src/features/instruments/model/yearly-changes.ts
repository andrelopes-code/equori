import type { components } from "@/api/schema.gen";
import { changeBp } from "@/features/instruments/model/price-stats";

type Price = components["schemas"]["Price"];

export interface YearlyChange {
  year: number;
  start: Price;
  end: Price;
  // Null when the start price is zero or start and end are the same price.
  changeBp: number | null;
  // The first year of the series: its start is the first price, not a year-end price.
  partialFrom: boolean;
  // The year of today: its end is the last price of the series.
  partialTo: boolean;
}

// YP2 to YP5: one row per calendar year with a price, newest first. A series inside one calendar
// year gives no row.
export function yearlyChanges(
  prices: readonly Price[],
  today: string,
): YearlyChange[] {
  const sorted = [...prices].sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0];
  const years = [...new Set(sorted.map((p) => yearOf(p.date)))];
  if (first === undefined || years.length < 2) return [];

  return years
    .map((year) => {
      const start = lastUntil(sorted, yearEnd(year - 1)) ?? first;
      const end = lastUntil(sorted, yearEnd(year)) ?? first;

      return {
        year,
        start,
        end,
        changeBp:
          start.date === end.date ? null : changeBp(start.value, end.value),
        partialFrom: year === yearOf(first.date),
        partialTo: year === yearOf(today),
      };
    })
    .reverse();
}

function lastUntil(sorted: readonly Price[], date: string): Price | undefined {
  return sorted.filter((p) => p.date <= date).at(-1);
}

function yearEnd(year: number): string {
  return `${String(year)}-12-31`;
}

function yearOf(date: string): number {
  return Number(date.slice(0, 4));
}
