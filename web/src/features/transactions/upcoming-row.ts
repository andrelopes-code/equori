import type { components } from "@/api/schema.gen";

type Occurrence = components["schemas"]["Occurrence"];
type Schedule = components["schemas"]["Schedule"];
type ScheduleKind = components["schemas"]["ScheduleKind"];

export interface UpcomingRow {
  id: string;
  date: string;
  description: string;
  kind: ScheduleKind | undefined;
  account: string;
  // Signed by its effect on the schedule's account: income adds, everything else takes.
  money: { amount: number; currency: string };
}

// Expected occurrences after today, the farthest first like the rows under them.
export function upcomingRows(
  occurrences: readonly Occurrence[],
  schedules: readonly Schedule[],
  accountNames: ReadonlyMap<string, string>,
  today: string,
): UpcomingRow[] {
  const byID = new Map(schedules.map((s) => [s.id, s]));
  return occurrences
    .filter((o) => o.state === "expected" && o.expected_on > today)
    .map((o) => {
      const schedule = byID.get(o.schedule_id);
      const sign = schedule?.kind === "income" ? 1 : -1;
      return {
        id: o.id,
        date: o.expected_on,
        description: schedule?.description ?? "",
        kind: schedule?.kind,
        account:
          schedule === undefined
            ? ""
            : (accountNames.get(schedule.account_id) ?? ""),
        money: {
          amount: sign * Math.abs(o.expected_amount.amount),
          currency: o.expected_amount.currency,
        },
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}
