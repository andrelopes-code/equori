import { shiftDate } from "@/i18n/format";

// listPrices reads at most 366 days.
export const maxPriceDays = 366;

export function priceWindow(
  today: string,
  days: number,
): { from: string; to: string } {
  const span = Math.min(Math.max(days, 1), maxPriceDays);
  return { from: shiftDate(today, -(span - 1)), to: today };
}
