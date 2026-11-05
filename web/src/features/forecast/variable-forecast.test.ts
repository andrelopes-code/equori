import { describe, expect, it } from "vitest";

import type { ForecastEntry } from "@/features/forecast/variable-forecast";
import { variableForecast } from "@/features/forecast/variable-forecast";

describe("variable forecast", () => {
  it("forecasts nothing without a history month", () => {
    const got = variableForecast({
      entries: [entry("2026-11-02", -5000)],
      month: "2026-11",
      today: "2026-11-05",
    });

    expect(got.history).toBe(0);
    expect(got.routine).toHaveLength(25);
    expect(got.routine.every((day) => day.amount === 0)).toBe(true);
    expect(got.recurring).toEqual([]);
    expect(got.range).toBeNull();
  });

  it("leaves the first month of the data out of the history", () => {
    const got = variableForecast({
      entries: [entry("2026-06-25", -5000), ...daily("2026-07", [1000])],
      month: "2026-08",
      today: "2026-08-05",
    });

    expect(got.history).toBe(1);
  });

  it("carries the routine of the history into each remaining day", () => {
    const got = variableForecast({
      entries: uniform(),
      month: "2026-11",
      today: "2026-11-05",
    });

    expect(got.history).toBe(4);
    expect(got.routine.map((day) => day.date)).toEqual(
      Array.from(
        { length: 25 },
        (_, i) => `2026-11-${String(6 + i).padStart(2, "0")}`,
      ),
    );
    for (const day of got.routine) expect(day.amount).toBeCloseTo(-1000);
    expect(got.range).toEqual({ lower: 0, upper: 0 });
  });

  it("leaves atypical purchases out, in the history and in the month", () => {
    const got = variableForecast({
      entries: [
        ...uniform(),
        entry("2026-09-16", -156300, "wheel"),
        entry("2026-10-08", -319000, "piano"),
        entry("2026-11-02", -250000, "desk"),
      ],
      month: "2026-11",
      today: "2026-11-05",
    });

    for (const day of got.routine) expect(day.amount).toBeCloseTo(-1000);
  });

  it("lowers the routine by a small refund and leaves out the refund of an atypical purchase", () => {
    const base = [entry("2026-09-30", -1000), ...daily("2026-10", [1000])];
    const forecast = (entries: ForecastEntry[]) =>
      variableForecast({ entries, month: "2026-11", today: "2026-11-05" })
        .routine[0]?.amount ?? 0;

    const without = forecast(base);
    const small = forecast([...base, entry("2026-10-10", 1000, "refund")]);
    const large = forecast([...base, entry("2026-10-10", 31000, "refund")]);

    expect(small).toBeCloseTo((without * 30) / 31);
    expect(large).toBeCloseTo(without);
  });

  it("leaves out purchases in categories that do not repeat across the months", () => {
    // Below the fence of 77.94, each in one month only.
    const got = variableForecast({
      entries: [
        ...varied(),
        entry("2026-08-12", -6000, "lamp"),
        entry("2026-09-12", -7000, "chair"),
        entry("2026-10-12", -5000, "gift"),
      ],
      month: "2026-11",
      today: "2026-11-05",
    });

    for (const day of got.routine) expect(day.amount).toBeCloseTo(-2000);
  });

  it("leaves out a purchase of the last month alone with two history months", () => {
    const got = variableForecast({
      entries: [
        entry("2026-08-31", -1000),
        ...["2026-09", "2026-10"].flatMap((month) => daily(month, [500, 1500])),
        ...daily("2026-11", [500, 1500], 5),
        entry("2026-10-12", -6000, "gift"),
      ],
      month: "2026-11",
      today: "2026-11-05",
    });

    expect(got.history).toBe(2);
    for (const day of got.routine) expect(day.amount).toBeCloseTo(-2000);
  });

  it("counts a category by its median over the months, the months without it as zero", () => {
    const got = variableForecast({
      entries: [
        ...varied(),
        entry("2026-09-12", -3000, "gym"),
        entry("2026-10-12", -3100, "gym"),
      ],
      month: "2026-11",
      today: "2026-11-05",
    });

    const usual = 2000 + (3000 / 30 + 3100 / 31) / 4;
    const pace = 10000 / (usual * 5);
    const want = -usual * (1 + (pace - 1) * (5 / 30));
    for (const day of got.routine) expect(day.amount).toBeCloseTo(want);
  });

  it("keeps the pace of the month to the categories the history repeats", () => {
    const got = variableForecast({
      entries: [...varied(), entry("2026-11-03", -6000, "lamp")],
      month: "2026-11",
      today: "2026-11-05",
    });

    for (const day of got.routine) expect(day.amount).toBeCloseTo(-2000);
  });

  it("forecasts a recurring payment apart from the routine", () => {
    const got = variableForecast({
      entries: [
        ...uniform(),
        ...["2026-07-05", "2026-08-04", "2026-09-08", "2026-10-08"].map(
          (date) => entry(date, -40000, "family", "Family"),
        ),
      ],
      month: "2026-11",
      today: "2026-11-05",
    });

    expect(got.recurring).toEqual([
      { date: "2026-11-07", amount: -40000, label: "Family" },
    ]);
    for (const day of got.routine) expect(day.amount).toBeCloseTo(-1000);
  });

  it.each([
    { name: "twice", perDay: 2000, pace: 2 },
    { name: "five times, held to twice", perDay: 5000, pace: 2 },
    { name: "nothing, held to half", perDay: 0, pace: 0.5 },
  ])(
    "weighs a month spending $name its routine by the share gone",
    ({ perDay, pace }) => {
      // Two entries a day, 500.00 and 1,500.00: a routine of 2,000.00 a day with a fence above
      // either amount.
      const got = variableForecast({
        entries: [
          entry("2026-06-30", -1000),
          ...["2026-07", "2026-08", "2026-09", "2026-10"].flatMap((month) =>
            daily(month, [500, 1500]),
          ),
          ...daily("2026-11", [perDay, perDay], 5),
        ],
        month: "2026-11",
        today: "2026-11-05",
      });

      const want = -2000 * (1 + (pace - 1) * (5 / 30));
      for (const day of got.routine) expect(day.amount).toBeCloseTo(want);
    },
  );

  it("states the likely range from the quartiles of three months", () => {
    // Routine rates of 1,000, 2,000 and 3,000 a day; the median is 2,000.
    const got = variableForecast({
      entries: [
        entry("2026-06-30", -1000),
        ...daily("2026-07", [1000]),
        ...daily("2026-08", [2000]),
        ...daily("2026-09", [3000]),
      ],
      month: "2026-10",
      today: "2026-10-20",
    });

    expect(got.range?.lower).toBeCloseTo(-5500);
    expect(got.range?.upper).toBeCloseTo(5500);
  });
});

// Four complete months of 10.00 a day, and the first five days of November at the same pace.
function uniform(): ForecastEntry[] {
  return [
    entry("2026-06-30", -1000),
    ...["2026-07", "2026-08", "2026-09", "2026-10"].flatMap((month) =>
      daily(month, [1000]),
    ),
    ...daily("2026-11", [1000], 5),
  ];
}

// Four complete months of two entries a day, 5.00 and 15.00: a routine of 20.00 a day with a fence
// of 77.94; and the first five days of November at the same pace.
function varied(): ForecastEntry[] {
  return [
    entry("2026-06-30", -1000),
    ...["2026-07", "2026-08", "2026-09", "2026-10"].flatMap((month) =>
      daily(month, [500, 1500]),
    ),
    ...daily("2026-11", [500, 1500], 5),
  ];
}

// One entry a day for each amount, each amount its own series.
function daily(
  month: string,
  amounts: readonly number[],
  upTo = 31,
): ForecastEntry[] {
  return daysOf(month)
    .filter((date) => Number(date.slice(8)) <= upTo)
    .flatMap((date) =>
      amounts
        .filter((amount) => amount !== 0)
        .map((amount, i) => entry(date, -amount, `daily-${String(i)}`)),
    );
}

function daysOf(month: string): string[] {
  const [year = 0, m = 1] = month.split("-").map(Number);
  const length = new Date(Date.UTC(year, m, 0)).getUTCDate();

  return Array.from(
    { length },
    (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`,
  );
}

function entry(
  date: string,
  amount: number,
  series = "daily-0",
  label = series,
): ForecastEntry {
  return {
    date,
    kind: amount > 0 && series !== "refund" ? "income" : "expense",
    amount,
    category: series,
    series,
    label,
  };
}
