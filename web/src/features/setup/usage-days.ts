import type { UsageDay } from "@/features/setup/api";
import { shiftDate } from "@/i18n/format";

export interface UsageDayRow {
  day: string;
  requests: number;
  errors: number;
  tokens: number;
}

// One row per day from `from` to `to`, both included, with the models and providers summed.
export function usageDayRows(
  items: readonly UsageDay[],
  from: string,
  to: string,
): UsageDayRow[] {
  const rows = new Map<string, UsageDayRow>();
  for (let day = from; day <= to; day = shiftDate(day, 1)) {
    rows.set(day, { day, requests: 0, errors: 0, tokens: 0 });
  }
  for (const item of items) {
    const row = rows.get(item.day);
    if (row === undefined) continue;
    row.requests += item.requests;
    row.errors += item.errors;
    row.tokens += item.tokens;
  }
  return [...rows.values()];
}
