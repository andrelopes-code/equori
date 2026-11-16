import { describe, expect, it } from "vitest";

import { forecastDays } from "@/features/forecast/forecast-days";

describe("forecast days", () => {
  it("starts on today and adds each day's scheduled, recurring and routine amounts", () => {
    const got = forecastDays({
      month: "2026-10",
      today: "2026-10-28",
      start: 100000,
      scheduled: [
        { date: "2026-10-28", amount: -20000 },
        { date: "2026-10-30", amount: 50000 },
      ],
      variable: {
        history: 3,
        routine: [
          { date: "2026-10-29", amount: -1000.4 },
          { date: "2026-10-30", amount: -1000.4 },
          { date: "2026-10-31", amount: -1000.4 },
        ],
        recurring: [{ date: "2026-10-30", amount: -5000, label: "Family" }],
        range: { lower: -3000, upper: 1500 },
      },
    });

    expect(got).toEqual([
      day("2026-10-28", [100000, 100000, 100000], [0, 0, 0]),
      // The occurrence dated today counts on the next day.
      day("2026-10-29", [79000, 78000, 79500], [-20000, 0, -1000]),
      day("2026-10-30", [122999, 120999, 123999], [50000, -5000, -1001]),
      day("2026-10-31", [121999, 118999, 123499], [0, 0, -1000]),
    ]);
  });

  it("adds the range of the start to the range of each day", () => {
    const got = forecastDays({
      month: "2026-11",
      today: "2026-10-31",
      start: 100000,
      startRange: { low: 90000, high: 105000 },
      scheduled: [{ date: "2026-11-02", amount: -2000 }],
      variable: {
        history: 3,
        routine: [
          { date: "2026-11-01", amount: -100 },
          { date: "2026-11-02", amount: -100 },
        ],
        recurring: [],
        range: { lower: -3000, upper: 3000 },
      },
    });

    expect(got).toHaveLength(31);
    expect(got[0]).toEqual(
      day("2026-10-31", [100000, 90000, 105000], [0, 0, 0]),
    );
    expect(got[1]).toEqual(
      day("2026-11-01", [99900, 89800, 105000], [0, 0, -100]),
    );
    expect(got[2]).toEqual(
      day("2026-11-02", [97800, 87600, 103000], [-2000, 0, -100]),
    );
    expect(got.at(-1)).toEqual(
      day("2026-11-30", [97800, 84800, 105800], [0, 0, 0]),
    );
  });

  it("states no range without one", () => {
    const got = forecastDays({
      month: "2026-10",
      today: "2026-10-30",
      start: 5000,
      scheduled: [],
      variable: {
        history: 0,
        routine: [{ date: "2026-10-31", amount: 0 }],
        recurring: [],
        range: null,
      },
    });

    expect(got.at(-1)).toEqual({
      date: "2026-10-31",
      value: 5000,
      scheduled: 0,
      recurring: 0,
      variable: 0,
    });
  });
});

function day(
  date: string,
  [value, low, high]: [number, number, number],
  [scheduled, recurring, variable]: [number, number, number],
) {
  return { date, value, low, high, scheduled, recurring, variable };
}
