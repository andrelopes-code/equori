import type { components } from "@/api/schema.gen";
import { addMonths } from "@/features/cards";
import { monthEnd } from "@/features/portfolio/projection/journey-block/journey-months";
import { contributionIn } from "@/features/portfolio/projection/model/contribution-in";

export type ContributionField = "date" | "recorded" | "planned";

// One record per date, in major units of the currency: what the chart reads.
export interface ContributionRow extends Record<ContributionField, unknown> {
  date: string;
  recorded: number | null;
  planned: number | null;
}

const recordedMonths = 60;

// PX8: the contribution of each of the last 60 months (the flow of the month, zero in a month of
// net withdrawal), then the contribution in force in each
// month from the current one to the withdrawal month.
export function contributionRows(
  points: readonly components["schemas"]["ReturnSeriesPoint"][],
  changes: readonly components["schemas"]["ProjectionChange"][],
  current: string,
  withdrawalFrom: string,
  scale: number,
): ContributionRow[] {
  const divisor = 10 ** scale;
  const recorded = points.slice(-recordedMonths).map((p): ContributionRow => ({
    date: p.date,
    recorded: Math.max(p.flows, 0) / divisor,
    planned: null,
  }));
  const planned: ContributionRow[] = [];

  for (
    let month = current;
    month <= withdrawalFrom;
    month = addMonths(month, 1)
  )
    planned.push({
      date: monthEnd(month),
      recorded: null,
      planned: contributionIn(changes, month) / divisor,
    });

  return [...recorded, ...planned];
}

// The top of the money axis: a third above the largest intention, so one large recorded month
// does not flatten the steps; its bar is cut at the top and the tooltip states its amount.
export function plotCeiling(
  rows: readonly ContributionRow[],
): number | undefined {
  const largest = Math.max(...rows.map((r) => r.planned ?? 0), 0);

  return largest > 0 ? (largest * 4) / 3 : undefined;
}
