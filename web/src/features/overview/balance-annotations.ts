import type { ChartAnnotation } from "@slotted/core/chart";

import {
  annotatedEvents,
  type ForecastDay,
} from "@/features/overview/forecast";

// The largest occurrences ahead as upright lines on the day axis; `dayLabel` writes a date as the
// chart's x value. A past month carries no events, so it draws none.
export function eventLines(
  days: readonly ForecastDay[],
  today: string | undefined,
  dayLabel: (date: string) => string,
): ChartAnnotation[] {
  const events = days.flatMap((day) => day.events);

  return annotatedEvents(events, today).map((event) => ({
    kind: "line",
    axis: "x",
    value: dayLabel(event.date),
    label: event.description,
    tone: "neutral",
  }));
}
