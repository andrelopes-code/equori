import type { components } from "@/api/schema.gen";
import { addMonths } from "@/features/cards";

type Change = components["schemas"]["ProjectionChange"];

export type MonthError = "taken" | "past";

// PJ2, PJ4: a month (`YYYY-MM`) before the current one, or already held by another change, is
// refused; a past month is reported before a taken one.
export function monthError(
  month: string,
  others: readonly Change[],
  current: string,
): MonthError | null {
  if (month < current) return "past";

  return others.some((c) => c.month.slice(0, 7) === month) ? "taken" : null;
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
