import type { components } from "@/api/schema.gen";
import { shiftDate } from "@/i18n/format";

type FlowDay = components["schemas"]["FlowDay"];

// Days since the Monday of the week holding the ISO date: 0 on a Monday, 6 on a Sunday.
export function daysSinceMonday(iso: string): number {
  return (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7;
}

// The outflow of each day from monday through monday + elapsed; 0 on a day without a flow.
export function weekOutflows(
  monday: string,
  elapsed: number,
  flows: readonly FlowDay[],
): number[] {
  return Array.from({ length: elapsed + 1 }, (_, i) => {
    const day = shiftDate(monday, i);

    return flows.find((f) => f.date === day)?.outflow.amount ?? 0;
  });
}
