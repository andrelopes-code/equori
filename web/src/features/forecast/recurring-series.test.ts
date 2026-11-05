import { describe, expect, it } from "vitest";

import { recurringSeries } from "@/features/forecast/recurring-series";
import type { ForecastEntry } from "@/features/forecast/variable-forecast";

const history = ["2026-07", "2026-08", "2026-09", "2026-10"];

describe("recurring series", () => {
  it("expects a monthly payment of a similar amount on its median day", () => {
    const entries = family();

    const got = recurringSeries({
      entries,
      history,
      month: "2026-11",
      today: "2026-11-05",
    });

    expect(got.estimates).toEqual([
      { date: "2026-11-07", amount: -40000, label: "Family" },
    ]);
    expect(got.matched.size).toBe(4);
  });

  it("expects nothing of purchases of different amounts", () => {
    const got = recurringSeries({
      entries: [
        entry("2026-07-26", -80000, "gear"),
        entry("2026-09-16", -156300, "gear"),
        entry("2026-10-08", -319000, "gear"),
      ],
      history,
      month: "2026-11",
      today: "2026-11-05",
    });

    expect(got.estimates).toEqual([]);
    expect(got.matched.size).toBe(0);
  });

  it("expects nothing once the month holds the payment, and leaves it out of the routine", () => {
    const paid = entry("2026-11-03", -40000, "family", "Family");

    const got = recurringSeries({
      entries: [...family(), paid],
      history,
      month: "2026-11",
      today: "2026-11-05",
    });

    expect(got.estimates).toEqual([]);
    expect(got.matched.has(paid)).toBe(true);
  });

  it.each([
    { today: "2026-11-05", want: ["2026-11-06"] },
    { today: "2026-11-08", want: ["2026-11-09"] },
    { today: "2026-11-09", want: [] },
  ])(
    "moves a payment late by up to seven days to tomorrow ($today)",
    ({ today, want }) => {
      const got = recurringSeries({
        entries: history.map((m) => entry(`${m}-01`, -4500, "phone")),
        history,
        month: "2026-11",
        today,
      });

      expect(got.estimates.map((estimate) => estimate.date)).toEqual(want);
    },
  );

  it("expects nothing of a payment absent from the last month, as one a schedule took over", () => {
    const got = recurringSeries({
      entries: [
        entry("2026-07-24", -57200, "claude"),
        entry("2026-08-30", -57200, "claude"),
        entry("2026-09-30", -57200, "claude"),
      ],
      history,
      month: "2026-11",
      today: "2026-11-05",
    });

    expect(got.estimates).toEqual([]);
  });

  it("keeps entries of three or more a month out of the series", () => {
    const rides = history.flatMap((m) =>
      Array.from({ length: 10 }, (_, i) =>
        entry(`${m}-${String(i + 10)}`, -1000, "rides"),
      ),
    );

    const got = recurringSeries({
      entries: rides,
      history,
      month: "2026-11",
      today: "2026-11-05",
    });

    expect(got.estimates).toEqual([]);
    expect(got.matched.size).toBe(0);
  });

  it("needs two history months", () => {
    const got = recurringSeries({
      entries: [entry("2026-10-08", -40000, "family")],
      history: ["2026-10"],
      month: "2026-11",
      today: "2026-11-05",
    });

    expect(got.estimates).toEqual([]);
  });

  it("puts a day past the month's length on its last day", () => {
    const got = recurringSeries({
      entries: [
        entry("2026-07-31", -9000, "rent"),
        entry("2026-08-31", -9000, "rent"),
        entry("2026-09-30", -9000, "rent"),
        entry("2026-10-31", -9000, "rent"),
      ],
      history,
      month: "2026-11",
      today: "2026-11-05",
    });

    expect(got.estimates.map((estimate) => estimate.date)).toEqual([
      "2026-11-30",
    ]);
  });
});

function family(): ForecastEntry[] {
  return [
    entry("2026-07-05", -40000, "family", "Family"),
    entry("2026-07-20", -100, "family", "Family"),
    entry("2026-08-04", -40000, "family", "Family"),
    entry("2026-09-08", -40000, "family", "Family"),
    entry("2026-10-08", -40000, "family", "Family"),
  ];
}

function entry(
  date: string,
  amount: number,
  series: string,
  label = series,
): ForecastEntry {
  return {
    date,
    kind: "expense",
    amount,
    category: series,
    series,
    label,
  };
}
