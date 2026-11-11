import { formatDayMonth, formatReferenceMonth } from "@/i18n/format";

// A223 RM6: above this many days the year is written, because a day and a month repeat.
const monthAxisFromDays = 100;

// A223 RM7: a marker on every price stops helping once the line is dense.
const maxMarkedPrices = 60;

// The days between the first and the last price; the prices need not be sorted.
export function axisSpanDays(prices: readonly { date: string }[]): number {
  if (prices.length < 2) return 0;

  const times = prices.map((p) => Date.parse(p.date));

  return Math.round((Math.max(...times) - Math.min(...times)) / 86_400_000);
}

export function axisLabel(
  value: number,
  locale: string,
  spanDays: number,
): string {
  const iso = new Date(value).toISOString().slice(0, 10);

  return spanDays > monthAxisFromDays
    ? formatReferenceMonth(iso.slice(0, 7), locale)
    : formatDayMonth(iso, locale);
}

export function showMarkers(count: number): boolean {
  return count <= maxMarkedPrices;
}
