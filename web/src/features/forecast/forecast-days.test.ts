import { describe, expect, it } from "vitest";

import { forecastDays } from "@/features/forecast/forecast-days";

describe("forecast days", () => {
  it("starts on today and adds each day's scheduled and variable amounts", () => {
    const got = forecastDays({
      month: "2026-10",
      today: "2026-10-28",
      start: 100000,
      events: [
        { date: "2026-10-28", amount: -20000 },
        { date: "2026-10-30", amount: 50000 },
      ],
      variable: {
        history: 3,
        days: [
          { date: "2026-10-29", amount: -1000.4 },
          { date: "2026-10-30", amount: -1000.4 },
          { date: "2026-10-31", amount: -1000.4 },
        ],
        range: { lower: -3000, upper: 1500 },
      },
    });

    expect(got).toEqual([
      day("2026-10-28", 100000, 100000, 100000, 0, 0),
      // The occurrence dated today counts on the next day.
      day("2026-10-29", 79000, 78000, 79500, -20000, -1000),
      day("2026-10-30", 127999, 125999, 128999, 50000, -1001),
      day("2026-10-31", 126999, 123999, 128499, 0, -1000),
    ]);
  });

  it("states no range without one", () => {
    const got = forecastDays({
      month: "2026-10",
      today: "2026-10-30",
      start: 5000,
      events: [],
      variable: {
        history: 0,
        days: [{ date: "2026-10-31", amount: 0 }],
        range: null,
      },
    });

    expect(got.at(-1)).toEqual({
      date: "2026-10-31",
      value: 5000,
      scheduled: 0,
      variable: 0,
    });
  });
});

function day(
  date: string,
  value: number,
  low: number,
  high: number,
  scheduled: number,
  variable: number,
) {
  return { date, value, low, high, scheduled, variable };
}
