import { describe, expect, it } from "vitest";

import { eventLines } from "@/features/overview/balance-annotations";
import type { ForecastDay } from "@/features/overview/forecast";

describe("eventLines", () => {
  it("marks the largest occurrences ahead on the day axis, labelled by their description", () => {
    const days: ForecastDay[] = [
      {
        date: "2026-10-05",
        realized: 500,
        forecast: 500,
        events: [],
      },
      {
        date: "2026-10-20",
        realized: undefined,
        forecast: -1500,
        events: [
          {
            date: "2026-10-20",
            occurrenceID: "o1",
            description: "Rent",
            kind: undefined,
            amount: -2000,
          },
        ],
      },
    ];

    const lines = eventLines(days, "2026-10-05", (date) => `day ${date}`);

    expect(lines).toEqual([
      {
        kind: "line",
        axis: "x",
        value: "day 2026-10-20",
        label: "Rent",
        tone: "neutral",
      },
    ]);
  });

  it("marks nothing in a month with no occurrence ahead", () => {
    const days: ForecastDay[] = [
      { date: "2026-09-30", realized: 500, forecast: undefined, events: [] },
    ];

    expect(eventLines(days, undefined, (date) => date)).toEqual([]);
  });
});
