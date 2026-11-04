import type { ChartAnnotation } from "@slotted/core/chart";

import type { ForecastDay } from "@/features/overview/forecast";

// Every occurrence ahead as an upright line on the day axis; `dayLabel` writes a date as the
// chart's x value. The chart keeps the labels of the largest amounts when labels collide and
// names the hidden ones in its tooltip (balance forecast design, B5). A past month carries no
// events, so it draws none.
export function eventLines(
  days: readonly ForecastDay[],
  dayLabel: (date: string) => string,
): ChartAnnotation[] {
  return days
    .flatMap((day) => day.events)
    .map((event) => ({
      kind: "line",
      axis: "x",
      value: dayLabel(event.date),
      label: event.description,
      tone: "neutral",
      priority: Math.abs(event.amount),
    }));
}
