import { describe, expect, it } from "vitest";

import { eventLines } from "@/features/overview/balance-annotations";
import type { ForecastDay } from "@/features/overview/forecast";

describe("eventLines", () => {
  it("marks an occurrence ahead on its day, labelled by its description, ranked by its amount", () => {
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

    const lines = eventLines(days, (date) => `day ${date}`);

    expect(lines).toEqual([
      {
        kind: "line",
        axis: "x",
        value: "day 2026-10-20",
        label: "Rent",
        tone: "neutral",
        priority: 2000,
      },
    ]);
  });

  it("S279: marks every occurrence ahead, however close, and ranks them by absolute amount", () => {
    const days: ForecastDay[] = [
      ["2026-11-05", -300],
      ["2026-11-06", 9000],
      ["2026-11-08", -120],
      ["2026-11-12", -4000],
    ].map(([date, amount]) => ({
      date: String(date),
      realized: undefined,
      forecast: 0,
      events: [
        {
          date: String(date),
          occurrenceID: String(date),
          description: String(date),
          kind: undefined,
          amount: Number(amount),
        },
      ],
    }));

    const lines = eventLines(days, (date) => date);

    expect(lines.map((line) => [line.value, line.priority])).toEqual([
      ["2026-11-05", 300],
      ["2026-11-06", 9000],
      ["2026-11-08", 120],
      ["2026-11-12", 4000],
    ]);
  });

  it("marks nothing in a month with no occurrence ahead", () => {
    const days: ForecastDay[] = [
      { date: "2026-09-30", realized: 500, forecast: undefined, events: [] },
    ];

    expect(eventLines(days, (date) => date)).toEqual([]);
  });
});
