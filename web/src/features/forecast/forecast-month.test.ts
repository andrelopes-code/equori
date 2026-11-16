import { describe, expect, it } from "vitest";

import { forecastMonth } from "@/features/forecast/forecast-month";
import type { ForecastEntry } from "@/features/forecast/variable-forecast";

describe("forecast month", () => {
  it("chains the month after the current one from the end of the current forecast", () => {
    const got = forecastMonth({
      entries: history(),
      events: [
        event("2026-10-25", -200000, "Rent"),
        event("2026-11-25", -200000, "Rent"),
      ],
      month: "2026-11",
      today: "2026-10-17",
      start: 100500,
    });

    // October ends at 1,005.00 − 2,000.00 − 14 × 10.00; November adds the rent and 30 × 10.00.
    expect(got.history).toBe(3);
    expect(got.points).toHaveLength(30);
    expect(got.points[0]).toMatchObject({ date: "2026-11-01", value: -114500 });
    expect(got.points.at(-1)).toMatchObject({
      date: "2026-11-30",
      value: -343500,
    });
    expect(got.events).toEqual([event("2026-11-25", -200000, "Rent")]);
  });

  it("counts an occurrence dated on the last day of the month on the first day of the next", () => {
    const got = forecastMonth({
      entries: history(),
      events: [event("2026-10-31", -5000, "Bill")],
      month: "2026-11",
      today: "2026-10-31",
      start: 100000,
    });

    expect(got.points[0]).toMatchObject({
      date: "2026-11-01",
      value: 100000 - 5000 - 1000,
      scheduled: -5000,
    });
    expect(got.events).toEqual([event("2026-10-31", -5000, "Bill")]);
  });

  it("forecasts the current month on its own", () => {
    const got = forecastMonth({
      entries: history(),
      events: [event("2026-11-25", -200000, "Rent")],
      month: "2026-10",
      today: "2026-10-17",
      start: 100500,
    });

    expect(got.points[0]).toMatchObject({ date: "2026-10-17", value: 100500 });
    expect(got.points.at(-1)).toMatchObject({ date: "2026-10-31" });
    expect(got.events).toEqual([]);
  });
});

// Ten reais a day from 2026-06-01 to 2026-10-17: July to September are the history months.
function history(): ForecastEntry[] {
  return days("2026-06-01", "2026-10-17").map((date) => ({
    date,
    kind: "expense",
    amount: -1000,
    category: "food",
    series: "food",
    label: "Food",
  }));
}

function days(from: string, to: string): string[] {
  const out: string[] = [];

  for (
    let d = new Date(`${from}T00:00:00Z`);
    d <= new Date(`${to}T00:00:00Z`);
    d = new Date(d.getTime() + 86400000)
  ) {
    out.push(d.toISOString().slice(0, 10));
  }

  return out;
}

function event(date: string, amount: number, description: string) {
  return {
    date,
    occurrenceID: "",
    description,
    kind: undefined,
    amount,
  };
}
