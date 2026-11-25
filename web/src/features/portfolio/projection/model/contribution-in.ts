import type { components } from "@/api/schema.gen";

type Change = components["schemas"]["ProjectionChange"];

// PJ2: the amount of the latest change dated on or before the month (`YYYY-MM`), 0 before the first.
export function contributionIn(
  changes: readonly Change[],
  month: string,
): number {
  let latest: Change | undefined;

  for (const change of changes) {
    const dated = change.month.slice(0, 7) <= month;
    const newer = latest === undefined || change.month > latest.month;
    if (dated && newer) latest = change;
  }

  return latest?.amount ?? 0;
}
