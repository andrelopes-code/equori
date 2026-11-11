import type { components } from "@/api/schema.gen";
import { shiftDate } from "@/i18n/format";

type OccurrenceState = components["schemas"]["OccurrenceState"];

export const upcomingDays = 7;

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
