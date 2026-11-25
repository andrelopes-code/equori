import type { components } from "@/api/schema.gen";
import { addMonths } from "@/features/cards";

type Change = components["schemas"]["ProjectionChange"];

export type MonthError = "taken" | "past" | "late";

// PJ2, PJ4, PX9: a month (`YYYY-MM`) before the current one, already held by another change, or
// from the month withdrawals start on, is refused; the first of the three is reported.
export function monthError(
  month: string,
  others: readonly Change[],
  current: string,
  withdrawalFrom: string,
): MonthError | null {
  if (month < current) return "past";

  if (others.some((c) => c.month.slice(0, 7) === month)) return "taken";

  return month >= withdrawalFrom ? "late" : null;
}

// The month a new change starts from: the one after the latest change, never before the current.
export function nextMonth(others: readonly Change[], current: string): string {
  const latest = others
    .map((c) => c.month.slice(0, 7))
    .sort()
    .at(-1);
  const after = latest === undefined ? current : addMonths(latest, 1);

  return after > current ? after : current;
}
