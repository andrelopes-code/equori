import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import {
  type AgendaRow,
  agenda,
  candidateWindow,
  monthTotals,
  netOf,
  realizeCandidates,
} from "@/features/planning/agenda";

type Occurrence = components["schemas"]["Occurrence"];
type Schedule = components["schemas"]["Schedule"];
type Transaction = components["schemas"]["Transaction"];

const brl = (amount: number) => ({ amount, currency: "BRL" });

function schedule(id: string, kind: Schedule["kind"], account = "acc-1") {
  return {
    id,
    kind,
    calendar: "c1",
    account_id: account,
    counterpart_id: "cat-1",
    description: id,
    match_tolerance_bp: 1000,
    grace_days: 3,
    terms: [],
    pauses: [],
  } satisfies Schedule;
}

function occurrence(
  id: string,
  scheduleID: string,
  date: string,
  amount: number,
  state: Occurrence["state"] = "expected",
): Occurrence {
  return {
    id,
    schedule_id: scheduleID,
    sequence: 1,
    expected_on: date,
    expected_amount: brl(amount),
    state,
  };
}

const rent = schedule("rent", "bill");
const salary = schedule("salary", "income", "acc-2");
const schedules = [rent, salary];

describe("agenda", () => {
  it("puts overdue occurrences first in their own group and the rest by day", () => {
    const month = [
      occurrence("o3", "rent", "2026-11-05", 210000),
      occurrence("o4", "salary", "2026-11-09", 500000),
      occurrence("o5", "rent", "2026-11-05", 1000, "realized"),
      occurrence("o2", "salary", "2026-11-02", 500000, "overdue"),
    ];
    const overdue = [
      occurrence("o1", "rent", "2026-10-05", 210000, "overdue"),
      occurrence("o2", "salary", "2026-11-02", 500000, "overdue"),
    ];
    const result = agenda(month, overdue, schedules, {});
    expect(result.overdue.map((r) => r.occurrence.id)).toEqual(["o1", "o2"]);
    expect(
      result.days.map((d) => [d.date, d.rows.map((r) => r.occurrence.id)]),
    ).toEqual([
      ["2026-11-05", ["o3", "o5"]],
      ["2026-11-09", ["o4"]],
    ]);
  });

  it("signs income positive and every other kind negative", () => {
    const result = agenda(
      [
        occurrence("o1", "rent", "2026-11-05", 210000),
        occurrence("o2", "salary", "2026-11-09", 500000),
      ],
      [],
      schedules,
      {},
    );
    expect(result.days.flatMap((d) => d.rows.map((r) => r.money))).toEqual([
      brl(-210000),
      brl(500000),
    ]);
  });

  it("keeps the rows of the chosen state, schedule, account and kind", () => {
    const month = [
      occurrence("o1", "rent", "2026-11-05", 210000),
      occurrence("o2", "salary", "2026-11-09", 500000),
      occurrence("o3", "rent", "2026-11-20", 210000, "skipped"),
    ];
    const ids = (filter: Parameters<typeof agenda>[3]) =>
      agenda(month, [], schedules, filter).days.flatMap((d) =>
        d.rows.map((r) => r.occurrence.id),
      );
    expect(ids({ state: "skipped" })).toEqual(["o3"]);
    expect(ids({ scheduleID: "salary" })).toEqual(["o2"]);
    expect(ids({ accountID: "acc-1" })).toEqual(["o1", "o3"]);
    expect(ids({ kind: "income" })).toEqual(["o2"]);
  });
});

describe("netOf", () => {
  const row = (id: string, amount: number, currency: string): AgendaRow => ({
    occurrence: occurrence(id, "rent", "2026-11-05", 0),
    schedule: rent,
    money: { amount, currency },
  });

  it("gives no total for no rows", () => {
    expect(netOf([])).toEqual([]);
  });

  it("gives one total per currency, ordered by the currency code", () => {
    expect(
      netOf([
        row("o1", -1000, "USD"),
        row("o2", -210000, "BRL"),
        row("o3", 500, "USD"),
        row("o4", 300000, "BRL"),
      ]),
    ).toEqual([
      { amount: 90000, currency: "BRL" },
      { amount: -500, currency: "USD" },
    ]);
  });
});

describe("monthTotals", () => {
  it("adds the expected inflow and outflow of the month, skipped ones left out", () => {
    const result = agenda(
      [
        occurrence("o1", "rent", "2026-11-05", 210000),
        occurrence("o2", "salary", "2026-11-09", 500000, "realized"),
        occurrence("o3", "rent", "2026-11-20", 3990, "overdue"),
        occurrence("o4", "rent", "2026-11-25", 9999, "skipped"),
      ],
      [occurrence("o0", "rent", "2026-10-05", 210000, "overdue")],
      schedules,
      {},
    );
    expect(monthTotals(result, "2026-11", "BRL")).toEqual({
      inflow: brl(500000),
      outflow: brl(213990),
    });
  });
});

function transaction(
  id: string,
  date: string,
  amount: number,
  account = "acc-1",
) {
  return {
    id,
    date,
    description: id,
    balancing_currency: "BRL",
    origin: "manual",
    version: 1,
    tags: [],
    links: [],
    postings: [
      {
        id: `${id}-p1`,
        account_id: account,
        amount: brl(amount),
        weight: brl(amount),
        status: "cleared",
      },
      {
        id: `${id}-p2`,
        account_id: "cat-1",
        amount: brl(-amount),
        weight: brl(-amount),
        status: "cleared",
      },
    ],
  } as unknown as Transaction;
}

describe("realizeCandidates", () => {
  it("reads the window of grace days around the expected date", () => {
    expect(
      candidateWindow(occurrence("o1", "rent", "2026-11-05", 210000), rent),
    ).toEqual({ from: "2026-11-02", to: "2026-11-08" });
  });

  it("orders the account's transactions by distance to the expected amount and marks the tolerance", () => {
    const result = realizeCandidates(
      [
        transaction("far", "2026-11-04", -150000),
        transaction("exact", "2026-11-06", -210000),
        transaction("near", "2026-11-05", -220000),
        transaction("other", "2026-11-05", -210000, "acc-9"),
      ],
      occurrence("o1", "rent", "2026-11-05", 210000),
      rent,
    );
    expect(
      result.map((c) => [c.transaction.id, c.amount, c.withinTolerance]),
    ).toEqual([
      ["exact", brl(-210000), true],
      ["near", brl(-220000), true],
      ["far", brl(-150000), false],
    ]);
  });
});
