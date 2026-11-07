import type { components } from "@/api/schema.gen";
import { changeBP } from "@/features/reports/report-change";
import type { ReportPeriod } from "@/features/reports/report-period";
import { shiftDate } from "@/i18n/format";

type CategoryTotal = components["schemas"]["CategoryTotal"];

export interface NetWorthGrowth {
  // Minor units.
  change: number;
  // Absent when the opening is zero (NP3).
  changeBP?: number;
  // Income minus expenses, and the change it does not explain (NP4); absent without a result.
  result?: number;
  other?: number;
}

export function netWorthGrowth(
  opening: number,
  closing: number,
  result: number | undefined,
): NetWorthGrowth {
  const change = closing - opening;
  const bp = changeBP(change, opening);

  return {
    change,
    ...(bp === undefined ? {} : { changeBP: bp }),
    ...(result === undefined ? {} : { result, other: change - result }),
  };
}

// NP4: /reports/categories reads at most 366 days, so a longer period is read in runs.
export function categoryRuns(from: string, to: string): ReportPeriod[] {
  const runs: ReportPeriod[] = [];
  for (let start = from; start <= to;) {
    const limit = shiftDate(start, 365);
    const end = limit < to ? limit : to;
    runs.push({ from: start, to: end });
    start = shiftDate(end, 1);
  }

  return runs;
}

// Each category's own total: a subtree total would count its children twice.
export function classTotal(items: readonly CategoryTotal[]): number {
  return items.reduce((sum, item) => sum + item.total.amount, 0);
}
