import type { components } from "@/api/schema.gen";
import { shiftDate } from "@/i18n/format";

type OccurrenceState = components["schemas"]["OccurrenceState"];
type ScheduleKind = components["schemas"]["ScheduleKind"];
type Money = components["schemas"]["Money"];

export const upcomingDays = 7;

const millisecondsPerDay = 86_400_000;

// Where the money of a schedule kind goes: a transfer and a saving stay with the owner (UP6).
const directions: Record<ScheduleKind, Direction> = {
  bill: "out",
  subscription: "out",
  income: "in",
  transfer: "none",
  savings: "none",
};

export type Direction = "in" | "out" | "none";

// "late" is an occurrence the API still expects past its date, inside the grace days (UP4).
export type Deadline = "overdue" | "late" | "ahead";

interface Due {
  id: string;
  schedule_id: string;
  expected_on: string;
  state: OccurrenceState;
  expected_amount: Money;
}

interface Named {
  id: string;
  description: string;
  kind: ScheduleKind;
}

export interface UpcomingEntry<T extends Due = Due> {
  occurrence: T;
  // Undefined when the schedule is absent or has no description (UP7).
  name: string | undefined;
  kind: ScheduleKind;
  // Calendar days from today to the expected date; negative when past.
  days: number;
  deadline: Deadline;
  direction: Direction;
  // The row above it in the same group falls on the same day (UP3).
  repeated: boolean;
  today: boolean;
}

export interface UpcomingView<T extends Due = Due> {
  late: UpcomingEntry<T>[];
  // The overdue amounts in the base currency, in minor units.
  lateSum: number;
  next: UpcomingEntry<T>[];
  // The last day of the window.
  until: string;
  leaving: Money[];
  entering: Money[];
}

// Overdue ones whatever their date, then the open ones up to a week ahead.
export function upcomingWindow<
  T extends { id: string; expected_on: string; state: OccurrenceState },
>(items: readonly T[], today: string): T[] {
  const end = shiftDate(today, upcomingDays);

  return items
    .filter(
      (item) =>
        item.state === "overdue" ||
        (item.state === "expected" && item.expected_on <= end),
    )
    .sort(
      (a, b) =>
        a.expected_on.localeCompare(b.expected_on) || a.id.localeCompare(b.id),
    );
}

// The groups, the rows and the totals the widget draws (spec, section 3). It holds no text.
export function upcomingView<T extends Due>(
  occurrences: readonly T[],
  schedules: readonly Named[],
  today: string,
  base: string,
): UpcomingView<T> {
  const entries = upcomingWindow(occurrences, today).map((occurrence) =>
    entryOf(occurrence, schedules, today),
  );
  const late = entries.filter((entry) => entry.deadline === "overdue");
  const next = entries.filter((entry) => entry.deadline !== "overdue");

  return {
    late: markRepeated(late),
    lateSum: late
      .filter((entry) => entry.occurrence.expected_amount.currency === base)
      .reduce((sum, entry) => sum + entry.occurrence.expected_amount.amount, 0),
    next: markRepeated(next),
    until: shiftDate(today, upcomingDays),
    leaving: totalOf(entries, "out", base),
    entering: totalOf(entries, "in", base),
  };
}

function entryOf<T extends Due>(
  occurrence: T,
  schedules: readonly Named[],
  today: string,
): UpcomingEntry<T> {
  const schedule = schedules.find((s) => s.id === occurrence.schedule_id);
  const kind = schedule?.kind ?? "bill";
  const days = daysBetween(today, occurrence.expected_on);

  return {
    occurrence,
    name: schedule?.description === "" ? undefined : schedule?.description,
    kind,
    days,
    deadline: deadlineOf(occurrence.state, days),
    direction: directions[kind],
    repeated: false,
    today: days === 0,
  };
}

function deadlineOf(state: OccurrenceState, days: number): Deadline {
  if (state === "overdue") return "overdue";

  return days < 0 ? "late" : "ahead";
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / millisecondsPerDay);
}

function markRepeated<T extends Due>(
  entries: UpcomingEntry<T>[],
): UpcomingEntry<T>[] {
  return entries.map((entry, index) => ({
    ...entry,
    repeated:
      entries[index - 1]?.occurrence.expected_on ===
      entry.occurrence.expected_on,
  }));
}

// One amount per currency, the base currency first and the others by code (UP6).
function totalOf(
  entries: readonly UpcomingEntry[],
  direction: Direction,
  base: string,
): Money[] {
  const sums = new Map<string, number>();

  for (const entry of entries) {
    if (entry.direction !== direction) continue;

    const { amount, currency } = entry.occurrence.expected_amount;
    sums.set(currency, (sums.get(currency) ?? 0) + amount);
  }

  return [...sums]
    .map(([currency, amount]) => ({ amount, currency }))
    .sort(
      (a, b) =>
        Number(b.currency === base) - Number(a.currency === base) ||
        a.currency.localeCompare(b.currency),
    );
}
