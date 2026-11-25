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

// PX8: the recorded flow of each of the last 60 months, then the contribution in force in each
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
    recorded: p.flows / divisor,
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
