import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import { subscriptionFigures } from "@/features/planning/subscriptions/subscription-figures";
import * as fixtures from "@/testing/planning-api";

type Occurrence = components["schemas"]["Occurrence"];
type Schedule = components["schemas"]["Schedule"];

const today = "2026-10-17";
// The fixtures type their enums as strings.
const streaming = fixtures.streamingSchedule as unknown as Schedule;
const charge = fixtures.streaming as Occurrence;
const next: Occurrence = {
  ...charge,
  id: "f1000000-0000-4000-8000-0000000000b1",
  expected_on: "2026-11-12",
  state: "expected",
};
const brl = (amount: number) => ({ amount, currency: "BRL" });
const streamingTerms = first(streaming.terms);

function first<T>(items: readonly T[]): T {
  const [item] = items;
  if (item === undefined) throw new Error("no item");

  return item;
}

function sub(
  id: string,
  amounts: [string, number][],
  extra: { ends_on?: string } = {},
): Schedule {
  return {
    ...streaming,
    id,
    description: id,
    terms: amounts.map(([from, amount]) => ({
      ...streamingTerms,
      effective_from: from,
      amount: brl(amount),
    })),
    pauses: [],
    ...extra,
  };
}

function figures(
  schedules: Schedule[],
  past: Occurrence[],
  upcoming: Occurrence[] = [],
) {
  return subscriptionFigures({
    schedules,
    past,
    upcoming,
    today,
    currency: "BRL",
  });
}

describe("subscriptionFigures", () => {
  it("costs, ranks and charts the streaming subscription of S29", () => {
    const got = figures([streaming], [charge], [next]);

    expect(got.monthly).toBe(3990);
    expect(got.yearly).toBe(47880);
    expect(got.charged).toBe(3990);
    expect(got.chargedDiff).toBe(0);
    expect(got.endedMonthly).toBe(0);
    expect(got.leftOut).toEqual([]);
    expect(got.active).toHaveLength(1);
    const line = first(got.active);
    expect([line.monthly, line.yearly, line.shareBp]).toEqual([
      3990, 47880, 10000,
    ]);
    expect(line.cells).toHaveLength(12);
    expect(line.cells[0]).toEqual({ month: "2025-11", state: "none" });
    expect(line.cells[11]).toEqual({
      month: "2026-10",
      state: "paid",
      charged: brl(3990),
      expected: brl(3990),
    });
    expect(got.changes).toEqual([
      {
        schedule: streaming,
        kind: "rises",
        on: "2027-01-01",
        from: brl(3990),
        to: brl(4490),
      },
    ]);
    expect(got.next).toEqual([
      { schedule: streaming, on: "2026-11-12", amount: brl(3990) },
    ]);
  });

  it("names a charge at another amount and counts the difference", () => {
    const other = { ...charge, actual_amount: brl(4290) };
    const skipped: Occurrence = {
      ...charge,
      id: "f1000000-0000-4000-8000-0000000000b2",
      expected_on: "2026-09-12",
      state: "skipped",
    };

    const got = figures([streaming], [skipped, other]);

    expect(got.charged).toBe(4290);
    expect(got.chargedDiff).toBe(300);
    expect(first(got.active).cells.slice(10)).toEqual([
      { month: "2026-09", state: "skipped" },
      {
        month: "2026-10",
        state: "other",
        charged: brl(4290),
        expected: brl(3990),
      },
    ]);
    expect(got.changes[0]).toEqual({
      schedule: streaming,
      kind: "charged",
      on: "2026-10-12",
      from: brl(3990),
      to: brl(4290),
    });
  });

  it("names a price that changed within the last 12 months", () => {
    const gym = sub("gym", [
      ["2025-12-01", 3490],
      ["2026-03-01", 3990],
    ]);

    expect(figures([gym], []).changes).toEqual([
      {
        schedule: gym,
        kind: "changed",
        on: "2026-03-01",
        from: brl(3490),
        to: brl(3990),
      },
    ]);
  });

  it("costs a yearly subscription by the month", () => {
    const prime = sub("prime", [["2025-03-02", 16680]]);
    prime.terms = [
      {
        ...streamingTerms,
        amount: brl(16680),
        recurrence: { ...streamingTerms.recurrence, frequency: "yearly" },
      },
    ];

    const line = first(figures([prime], []).active);

    expect([line.monthly, line.yearly]).toEqual([1390, 16680]);
  });

  it("leaves another currency and the ended ones out of the totals", () => {
    const usd = {
      ...sub("usd", [["2026-01-01", 0]]),
      terms: [{ ...streamingTerms, amount: { amount: 2000, currency: "USD" } }],
    };
    const gym = sub("gym", [["2026-01-01", 10000]], { ends_on: "2026-09-01" });

    const got = figures([usd, gym, streaming], []);

    expect(got.active.map((l) => [l.schedule.id, l.shareBp])).toEqual([
      [streaming.id, 10000],
      ["usd", undefined],
    ]);
    expect(got.ended.map((l) => l.schedule.id)).toEqual(["gym"]);
    expect(got.monthly).toBe(3990);
    expect(got.endedMonthly).toBe(10000);
    expect(got.leftOut).toEqual([{ amount: 2000, currency: "USD" }]);
  });

  it("ranks by the monthly cost and keeps the 5 next charges in date order", () => {
    const big = sub("big", [["2026-01-01", 20990]]);
    const charges = [5, 1, 4, 2, 3, 6].map((day) => ({
      ...next,
      id: `f1000000-0000-4000-8000-00000000010${String(day)}`,
      schedule_id: day % 2 === 0 ? "big" : streaming.id,
      expected_on: `2026-11-0${String(day)}`,
    }));

    const got = figures([streaming, big], [], charges);

    expect(got.active.map((l) => [l.schedule.id, l.shareBp])).toEqual([
      ["big", 8403],
      [streaming.id, 1597],
    ]);
    expect(got.next.map((n) => n.on)).toEqual([
      "2026-11-01",
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
      "2026-11-05",
    ]);
  });
});
