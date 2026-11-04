import { describe, expect, it } from "vitest";

import {
  buildForecast,
  cardsPaidBySchedule,
  lowestAhead,
  mergeEvents,
  monthDays,
  monthEnd,
  statementEvents,
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

  it("counts the occurrences dated today from the next day, and on today at month end", () => {
    const due = {
      date: "2026-10-18",
      occurrenceID: "late",
      description: "Statement",
      kind: undefined,
      amount: -500,
    };
    const forecast = (today: string) =>
      buildForecast({
        month: "2026-10",
        today,
        realized: new Map([[today, 8000]]),
        todayBalance: 8000,
        events: [{ ...due, date: today }],
      });

    const mid = forecast("2026-10-18");
    const last = forecast("2026-10-31");

    expect(mid[17]).toMatchObject({ realized: 8000, forecast: 8000 });
    expect(mid[18]).toMatchObject({ forecast: 7500 });
    expect(mid[30]).toMatchObject({ forecast: 7500 });
    expect(last[30]).toMatchObject({ realized: 8000, forecast: 7500 });
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

describe("statementEvents", () => {
  const owed = (id: string, due: string, amount: number, currency = "BRL") => ({
    account: { id: `card-${id}`, name: `Card ${id}` },
    statement: { id, due_date: due },
    amount: { amount, currency },
  });

  it("S278: draws each owed statement due by month end as an outflow on its due date", () => {
    const events = statementEvents({
      owed: [
        owed("s1", "2026-11-05", 120000),
        owed("s2", "2026-10-20", 5000),
        owed("s3", "2026-12-07", 9000),
        owed("s4", "2026-11-10", 7000, "USD"),
        owed("s5", "2026-11-12", 3000),
      ],
      base: "BRL",
      today: "2026-11-04",
      end: "2026-11-30",
      paid: new Set(["card-s5"]),
      describe: (card) => `${card} statement`,
    });

    expect(events).toEqual([
      {
        date: "2026-11-05",
        occurrenceID: "statement-s1",
        description: "Card s1 statement",
        kind: undefined,
        amount: -120000,
      },
      {
        date: "2026-11-04",
        occurrenceID: "statement-s2",
        description: "Card s2 statement",
        kind: undefined,
        amount: -5000,
      },
    ]);
  });
});

describe("cardsPaidBySchedule", () => {
  it("names the accounts of the schedules expected by month end", () => {
    const schedules = new Map([
      ["pay", { account_id: "checking", counterpart_id: "card" }],
      ["late", { account_id: "checking", counterpart_id: "other-card" }],
    ]);

    const paid = cardsPaidBySchedule(
      [
        { date: "2026-11-10", schedule_id: "pay" },
        { date: "2026-12-10", schedule_id: "late" },
      ],
      schedules,
      "2026-11-30",
    );

    expect([...paid].sort()).toEqual(["card", "checking"]);
  });
});
