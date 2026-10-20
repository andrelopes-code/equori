import { describe, expect, it } from "vitest";

import {
  annotatedEvents,
  buildForecast,
  lowestAhead,
  mergeEvents,
  monthDays,
  monthEnd,
  sumByDate,
} from "@/features/overview/forecast";

describe("month helpers", () => {
  it("lists every day of a month and its last day", () => {
    expect(monthDays("2026-02")).toHaveLength(28);
    expect(monthDays("2026-10").at(0)).toBe("2026-10-01");
    expect(monthEnd("2026-10")).toBe("2026-10-31");
    expect(monthEnd("2028-02")).toBe("2028-02-29");
  });
});

describe("sumByDate", () => {
  it("adds the balances of several accounts per day", () => {
    const sums = sumByDate([
      [
        { date: "2026-10-01", balance: { amount: 100, currency: "BRL" } },
        { date: "2026-10-02", balance: { amount: 150, currency: "BRL" } },
      ],
      [{ date: "2026-10-02", balance: { amount: 50, currency: "BRL" } }],
    ]);
    expect(Object.fromEntries(sums)).toEqual({
      "2026-10-01": 100,
      "2026-10-02": 200,
    });
  });
});

describe("mergeEvents", () => {
  it("nets the two sides of a transfer between scoped accounts and drops it", () => {
    const events = mergeEvents(
      [
        [
          {
            date: "2026-10-20",
            occurrence_id: "o1",
            schedule_id: "s1",
            amount: -1000,
          },
          {
            date: "2026-10-25",
            occurrence_id: "o2",
            schedule_id: "s2",
            amount: -500,
          },
        ],
        [
          {
            date: "2026-10-25",
            occurrence_id: "o2",
            schedule_id: "s2",
            amount: 500,
          },
        ],
      ],
      new Map([
        ["s1", { description: "Internet", kind: "subscription" as const }],
        ["s2", { description: "Reserva", kind: "transfer" as const }],
      ]),
    );
    expect(events).toEqual([
      {
        date: "2026-10-20",
        occurrenceID: "o1",
        description: "Internet",
        kind: "subscription",
        amount: -1000,
      },
    ]);
  });
});

describe("buildForecast", () => {
  const events = [
    {
      date: "2026-10-20",
      occurrenceID: "o1",
      description: "Internet",
      kind: "subscription" as const,
      amount: -1000,
    },
    {
      date: "2026-10-25",
      occurrenceID: "o2",
      description: "Fatura",
      kind: "transfer" as const,
      amount: -3000,
    },
  ];

  it("carries the realized balance up to today and the forecast after it", () => {
    const days = buildForecast({
      month: "2026-10",
      today: "2026-10-18",
      realized: new Map([
        ["2026-10-01", 5000],
        ["2026-10-10", 9000],
        ["2026-10-18", 8000],
      ]),
      todayBalance: 8000,
      events,
    });
    expect(days).toHaveLength(31);
    expect(days[0]).toMatchObject({ date: "2026-10-01", realized: 5000 });
    expect(days[5]).toMatchObject({ realized: 5000, forecast: undefined });
    expect(days[17]).toMatchObject({ realized: 8000, forecast: 8000 });
    expect(days[19]).toMatchObject({ realized: undefined, forecast: 7000 });
    expect(days[19]?.events.map((e) => e.occurrenceID)).toEqual(["o1"]);
    expect(days[30]).toMatchObject({ forecast: 4000 });
  });

  it("reads a past month as realized only", () => {
    const days = buildForecast({
      month: "2026-09",
      today: "2026-10-18",
      realized: new Map([["2026-09-01", 100]]),
      todayBalance: 0,
      events: [],
    });
    expect(days).toHaveLength(30);
    expect(days.every((d) => d.forecast === undefined)).toBe(true);
    expect(days[29]?.realized).toBe(100);
  });

  it("finds the lowest balance ahead and the event that causes it", () => {
    const days = buildForecast({
      month: "2026-10",
      today: "2026-10-18",
      realized: new Map([["2026-10-18", 8000]]),
      todayBalance: 8000,
      events,
    });
    expect(lowestAhead(days)).toEqual({
      date: "2026-10-25",
      balance: 4000,
      event: events[1],
    });
  });
});

// An annotation's label ends on its line, so two lines need room for the
// later label between them.
describe("annotatedEvents", () => {
  const event = (date: string, amount: number) => ({
    date,
    amount,
    description: date,
    occurrenceID: date,
    kind: "bill" as const,
  });

  it("keeps the largest occurrences at least eight days from today and from each other", () => {
    const events = [
      event("2026-10-20", -11990),
      event("2026-10-25", -222620),
      event("2026-10-26", -100000),
      event("2026-10-30", -50000),
      event("2026-11-05", -360000),
    ];
    expect(annotatedEvents(events, "2026-10-18").map((e) => e.date)).toEqual([
      "2026-11-05",
      "2026-10-26",
    ]);
  });

  it("annotates at most three occurrences", () => {
    const events = ["01", "09", "17", "25"].map((day, n) =>
      event(`2026-11-${day}`, -1000 * (n + 1)),
    );
    expect(annotatedEvents(events, undefined)).toHaveLength(3);
  });
});
