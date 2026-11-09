import { shiftDate } from "@/i18n/format";

export type PriceRange = "m1" | "m3" | "y1" | "y5" | "max";

// listPrices reads at most 18,300 days.
export const maxPriceDays = 18_300;

export const priceRanges: readonly PriceRange[] = [
  "m1",
  "m3",
  "y1",
  "y5",
  "max",
];

const rangeDays = { m1: 30, m3: 90, y1: 366, y5: 1827 } as const;

export function rangeWindow(
  today: string,
  range: PriceRange,
  first: string | null,
): { from: string; to: string } {
  if (range !== "max") return priceWindow(today, rangeDays[range]);

  const floor = priceWindow(today, maxPriceDays).from;

  return { from: first !== null && first > floor ? first : floor, to: today };
}

export function priceWindow(
  today: string,
  days: number,
): { from: string; to: string } {
  const span = Math.min(Math.max(days, 1), maxPriceDays);
  return { from: shiftDate(today, -(span - 1)), to: today };
}
