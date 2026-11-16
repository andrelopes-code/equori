import { describe, expect, it } from "vitest";

import {
  attentionCount,
  attentionItems,
} from "@/features/overview/attention/attention";

const account = (id: string) => ({ id, name: id }) as never;
const money = (amount: number) => ({ amount, currency: "BRL" });
const today = "2026-10-17";
const statement = (id: string, due_date: string, unpaid = 50000) =>
  ({ id, due_date, unpaid: money(unpaid) }) as never;
const budget = (id: string, planned: number, spent: number, carried = 0) => ({
  id,
  name: id,
  progress: {
    planned: money(planned),
    carried: money(carried),
    spent: money(spent),
    available: money(planned + carried - spent),
  },
});
const empty = {
  today,
  uncategorized: 0,
  unconfirmed: [],
  connections: [],
  differences: [],
  statements: [],
  budgets: [],
};

describe("attentionItems", () => {
  it("is empty when nothing needs attention", () => {
    expect(
      attentionItems({ ...empty, connections: [{ state: "ok" }] }),
    ).toEqual([]);
  });

  it("counts the connections that need action in one high item", () => {
    const items = attentionItems({
      ...empty,
      connections: [
        { state: "ok" },
        { state: "failed" },
        { state: "needs_owner" },
      ],
    });
    expect(items).toEqual([{ kind: "connections", weight: "high", count: 2 }]);
  });

  // S247
  it("notices a statement due within three days or past due, with the days", () => {
    const items = attentionItems({
      ...empty,
      today: "2026-11-10",
      statements: [
        {
          account: account("c"),
          unpaid: [
            statement("s13", "2026-11-13"),
            statement("s07", "2026-11-07"),
            statement("s10", "2026-11-10"),
            statement("s14", "2026-11-14"),
          ],
        },
      ],
    });
    expect(
      items.map((i) => [
        i.kind,
        i.weight,
        i.kind === "statement" && i.statement.id,
        i.kind === "statement" && i.days,
      ]),
    ).toEqual([
      ["statement", "critical", "s07", 3],
      ["statement", "high", "s10", 0],
      ["statement", "high", "s13", 3],
    ]);
  });

  // S248
  it("makes one item per budget over its amount, weighted by the overrun share", () => {
    const items = attentionItems({
      ...empty,
      budgets: [
        budget("exact", 1000, 1000),
        budget("family", 40000, 42700),
        budget("market", 120000, 148000),
        budget("carried", 1000, 1600, 500),
        budget("none", 0, 500),
      ],
    });
    expect(
      items.map(
        (i) =>
          i.kind === "budget" && [i.id, i.weight, i.share, i.overrun.amount],
      ),
    ).toEqual([
      ["none", "normal", 100, 500],
      ["market", "normal", 23, 28000],
      ["carried", "low", 7, 100],
      ["family", "low", 7, 2700],
    ]);
  });

  it("keeps a budget at exactly ten percent over within the margin", () => {
    const items = attentionItems({
      ...empty,
      budgets: [budget("a", 1000, 1100), budget("b", 1000, 1111)],
    });
    expect(
      items.map((i) => i.kind === "budget" && [i.id, i.weight, i.share]),
    ).toEqual([
      ["b", "normal", 11],
      ["a", "low", 10],
    ]);
  });

  it("joins the transactions to review in one item, widest source first", () => {
    const items = attentionItems({
      ...empty,
      uncategorized: 3,
      unconfirmed: [
        { account: account("a"), count: 2 },
        { account: account("b"), count: 0 },
        { account: account("c"), count: 5, statementId: "s1" },
      ],
    });
    expect(items).toEqual([
      {
        kind: "review",
        weight: "normal",
        total: 10,
        more: false,
        segments: [
          {
            kind: "account",
            account: account("c"),
            count: 5,
            statementId: "s1",
          },
          { kind: "uncategorized", count: 3 },
          { kind: "account", account: account("a"), count: 2 },
        ],
      },
    ]);
  });

  it("flags a lower bound when the uncategorized read has more", () => {
    const items = attentionItems({
      ...empty,
      uncategorized: 50,
      uncategorizedMore: true,
    });
    expect(items[0]).toMatchObject({ kind: "review", total: 50, more: true });
  });

  // A133
  it("carries an account's unconfirmed count on its difference item", () => {
    const items = attentionItems({
      ...empty,
      unconfirmed: [{ account: account("a"), count: 2 }],
      differences: [
        { account: account("a"), difference: money(-1500) },
        { account: account("b"), difference: undefined },
        { account: account("z"), difference: money(0) },
      ],
    });
    expect(items).toEqual([
      {
        kind: "difference",
        weight: "normal",
        account: account("a"),
        difference: money(-1500),
        unconfirmed: 2,
      },
    ]);
  });

  it("orders by weight, then critical, high, budgets, review, difference, low", () => {
    const items = attentionItems({
      ...empty,
      uncategorized: 1,
      connections: [{ state: "failed" }],
      differences: [{ account: account("d"), difference: money(-100) }],
      statements: [
        {
          account: account("c"),
          unpaid: [
            statement("late", "2026-10-10"),
            statement("soon", "2026-10-18"),
          ],
        },
      ],
      budgets: [budget("small", 1000, 1050), budget("big", 1000, 2000)],
    });
    expect(items.map((i) => [i.kind, i.weight])).toEqual([
      ["statement", "critical"],
      ["statement", "high"],
      ["connections", "high"],
      ["budget", "normal"],
      ["review", "normal"],
      ["difference", "normal"],
      ["budget", "low"],
    ]);
  });
});

describe("attentionCount", () => {
  it("leaves out the items of the lowest weight", () => {
    const items = attentionItems({
      ...empty,
      connections: [{ state: "failed" }],
      budgets: [budget("big", 1000, 2000), budget("small", 1000, 1050)],
    });
    expect(items).toHaveLength(3);
    expect(attentionCount(items)).toBe(2);
  });

  describe("fixed income", () => {
    const fixed = (kind: string, date: string, state: string, gross = 100) =>
      ({
        account_id: "a",
        instrument: "CDB1",
        date,
        kind,
        quantity: money(1),
        gross: money(gross),
        rate_missing: false,
        state,
      }) as never;

    it("gives one normal item per due interest", () => {
      const event = fixed("interest", "2026-10-15", "due");
      expect(attentionItems({ ...empty, fixedIncome: [event] })).toEqual([
        { kind: "fixed_income_due", weight: "normal", event },
      ]);
    });

    it("gives a high item to a due maturity", () => {
      const items = attentionItems({
        ...empty,
        fixedIncome: [fixed("maturity", "2026-10-15", "due")],
      });
      expect(items.map((i) => [i.kind, i.weight])).toEqual([
        ["fixed_income_due", "high"],
      ]);
    });

    it("sums the upcoming events of the next 7 days in one low item", () => {
      const items = attentionItems({
        ...empty,
        fixedIncome: [
          fixed("interest", "2026-10-18", "upcoming", 100),
          fixed("amortization", "2026-10-24", "upcoming", 250),
          fixed("interest", "2026-10-25", "upcoming", 999),
          fixed("interest", "2026-10-10", "recorded", 999),
        ],
      });
      expect(items).toEqual([
        {
          kind: "fixed_income_week",
          weight: "low",
          count: 2,
          total: money(350),
        },
      ]);
    });

    it("gives one week item per currency", () => {
      const usd = {
        ...(fixed("interest", "2026-10-20", "upcoming", 70) as object),
        gross: { amount: 70, currency: "USD" },
      } as never;
      const items = attentionItems({
        ...empty,
        fixedIncome: [fixed("interest", "2026-10-18", "upcoming", 100), usd],
      });

      expect(items).toEqual([
        {
          kind: "fixed_income_week",
          weight: "low",
          count: 1,
          total: money(100),
        },
        {
          kind: "fixed_income_week",
          weight: "low",
          count: 1,
          total: { amount: 70, currency: "USD" },
        },
      ]);
    });
  });
});
