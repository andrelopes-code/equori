import { describe, expect, it } from "vitest";

import type { ForecastEntry } from "@/features/forecast/variable-forecast";
import { variableForecast } from "@/features/forecast/variable-forecast";

describe("variable forecast", () => {
  it("forecasts nothing without a history month", () => {
    const got = variableForecast({
      entries: [expense("2026-10-05", 5000)],
      month: "2026-10",
      today: "2026-10-20",
    });

    expect(got.history).toBe(0);
    expect(got.days).toHaveLength(11);
    expect(got.days.every((day) => day.amount === 0)).toBe(true);
    expect(got.range).toBeNull();
  });

  it("carries a uniform history into each remaining day", () => {
    const got = variableForecast({
      entries: [
        ...daily("2026-07", 1000),
        ...daily("2026-08", 1000),
        ...daily("2026-09", 1000),
        ...daily("2026-10", 1000, 20),
      ],
      month: "2026-10",
      today: "2026-10-20",
    });

    expect(got.history).toBe(3);
    expect(got.days.map((day) => day.date)).toEqual(
      Array.from({ length: 11 }, (_, i) => `2026-10-${String(21 + i)}`),
    );
    for (const day of got.days) expect(day.amount).toBeCloseTo(-1000);
    expect(got.range).toEqual({ lower: 0, upper: 0 });
  });

  it.each([
    { name: "twice", perDay: 2000 },
    { name: "five times, held to twice", perDay: 5000 },
  ])(
    "weighs a month spending $name its history by the share gone",
    ({ perDay }) => {
      const got = variableForecast({
        entries: [
          ...daily("2026-07", 1000),
          ...daily("2026-08", 1000),
          ...daily("2026-09", 1000),
          ...daily("2026-10", perDay, 20),
        ],
        month: "2026-10",
        today: "2026-10-20",
      });

      // E × (1 + (2 − 1) × 20 ÷ 31) over 11 days, spread evenly.
      const want = -(11000 * (1 + 20 / 31)) / 11;
      for (const day of got.days) expect(day.amount).toBeCloseTo(want);
    },
  );

  it("puts an income on its day of the month while that day is ahead", () => {
    const salaries = ["2026-07-25", "2026-08-25", "2026-09-25"].map((date) =>
      income(date, 500000),
    );

    const ahead = variableForecast({
      entries: salaries,
      month: "2026-10",
      today: "2026-10-20",
    });
    const past = variableForecast({
      entries: salaries,
      month: "2026-10",
      today: "2026-10-26",
    });

    expect(
      ahead.days.find((day) => day.date === "2026-10-25")?.amount,
    ).toBeCloseTo(500000);
    expect(
      ahead.days
        .filter((day) => day.date !== "2026-10-25")
        .every((day) => day.amount === 0),
    ).toBe(true);
    expect(past.days.every((day) => day.amount === 0)).toBe(true);
  });

  it("reads the whole month when today is past a history month's last day", () => {
    const got = variableForecast({
      entries: [expense("2026-09-10", 30000), expense("2026-10-10", 30000)],
      month: "2026-10",
      today: "2026-10-30",
    });

    expect(got.days).toEqual([{ date: "2026-10-31", amount: -1000 }]);
  });

  it("leaves a one-off purchase of one month out by the median", () => {
    const got = variableForecast({
      entries: [
        ...daily("2026-07", 1000),
        ...daily("2026-08", 1000),
        expense("2026-08-28", 400000),
        ...daily("2026-09", 1000),
        ...daily("2026-10", 1000, 20),
      ],
      month: "2026-10",
      today: "2026-10-20",
    });

    expect(got.days[0]?.amount).toBeCloseTo(-1000);
    expect(got.range?.upper).toBe(0);
    expect(got.range?.lower).toBeLessThan(0);
  });

  it("spreads the expenses by weekday", () => {
    // Every Saturday of the history holds 7,000.00; no other day spends.
    const saturdays = ["2026-07", "2026-08", "2026-09"].flatMap((month) =>
      daysOf(month)
        .filter((date) => new Date(`${date}T00:00:00Z`).getUTCDay() === 6)
        .map((date) => expense(date, 700000)),
    );

    const got = variableForecast({
      entries: saturdays,
      month: "2026-10",
      today: "2026-10-20",
    });

    const spent = got.days.filter((day) => day.amount !== 0);
    expect(spent.map((day) => day.date)).toEqual(["2026-10-24", "2026-10-31"]);
    expect(spent[0]?.amount).toBeCloseTo(spent[1]?.amount ?? 0);
  });

  it("states the likely range from the quartiles of three months", () => {
    // Tail rates of 1,000, 2,000 and 3,000 a day; the median is 2,000.
    const got = variableForecast({
      entries: [
        ...daily("2026-07", 1000),
        ...daily("2026-08", 2000),
        ...daily("2026-09", 3000),
      ],
      month: "2026-10",
      today: "2026-10-20",
    });

    // Net rates −3,000, −2,000, −1,000: q25 −2,500 and q75 −1,500 a day, against the median's
    // −2,000, over 11 days.
    expect(got.range?.lower).toBeCloseTo(-5500);
    expect(got.range?.upper).toBeCloseTo(5500);
  });

  it("counts history only from the month of the earliest entry", () => {
    const got = variableForecast({
      entries: [...daily("2026-09", 1000)],
      month: "2026-10",
      today: "2026-10-20",
    });

    expect(got.history).toBe(1);
    expect(got.range).toBeNull();
  });
});

function daily(month: string, amount: number, upTo = 31): ForecastEntry[] {
  return daysOf(month)
    .filter((date) => Number(date.slice(8)) <= upTo)
    .map((date) => expense(date, amount));
}

function daysOf(month: string): string[] {
  const [year = 0, m = 1] = month.split("-").map(Number);
  const length = new Date(Date.UTC(year, m, 0)).getUTCDate();

  return Array.from(
    { length },
    (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`,
  );
}

function expense(date: string, amount: number): ForecastEntry {
  return { date, kind: "expense", amount: -amount };
}

function income(date: string, amount: number): ForecastEntry {
  return { date, kind: "income", amount };
}
