import type { MonthCell } from "@/features/planning/subscriptions/subscription-figures";

// The height of each month's bar in percent of the largest amount of the 12: what was charged,
// or what is expected for a month not charged yet; 0 for a month without an amount (spec C3).
export function monthHeights(cells: readonly MonthCell[]): number[] {
  const amounts = cells.map((c) =>
    Math.abs((c.charged ?? c.expected)?.amount ?? 0),
  );
  const largest = Math.max(0, ...amounts);
  if (largest === 0) return amounts.map(() => 0);

  return amounts.map((a) => Math.round((a * 100) / largest));
}
