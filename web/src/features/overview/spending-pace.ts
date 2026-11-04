import type { components } from "@/api/schema.gen";
import { monthEnd, shiftMonth } from "@/features/overview/forecast";

type CategoryTotal = components["schemas"]["CategoryTotal"];

export interface PaceRange {
  from: string;
  to: string;
}

// The month up to today, and the same days of the month before; a shorter month before ends on
// its last day (spending pace design, section 3).
export function paceRanges(today: string): {
  current: PaceRange;
  previous: PaceRange;
} {
  const month = today.slice(0, 7);
  const previous = shiftMonth(month, -1);
  const sameDay = `${previous}-${today.slice(8, 10)}`;
  const last = monthEnd(previous);

  return {
    current: { from: `${month}-01`, to: today },
    previous: { from: `${previous}-01`, to: sameDay < last ? sameDay : last },
  };
}

// Own totals in the base currency, so a parent and its children never count one posting twice;
// a refund is a negative total and lowers the sum.
export function spendingOf(
  items: readonly CategoryTotal[],
  base: string,
): number {
  return items
    .filter((item) => item.total.currency === base)
    .reduce((sum, item) => sum + item.total.amount, 0);
}

// A fraction: 0.25 reads "+25%". No change against a previous sum that is zero or negative.
export function paceChange(
  current: number,
  previous: number,
): number | undefined {
  return previous <= 0 ? undefined : (current - previous) / previous;
}
