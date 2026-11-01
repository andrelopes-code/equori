import { describe, expect, it } from "vitest";

import { attentionItems } from "@/features/overview/attention";

const account = (id: string) => ({ id, name: id }) as never;
const money = (amount: number) => ({ amount, currency: "BRL" });
const today = "2026-10-17";
const statement = (id: string, due_date: string, unpaid = 50000) =>
  ({ id, due_date, unpaid: money(unpaid) }) as never;
const progress = (planned: number, spent: number) => ({
  progress: {
    planned: money(planned),
    carried: money(0),
    spent: money(spent),
    available: money(planned - spent),
  },
});

describe("attentionItems", () => {
  it("counts each kind and leaves out the ones with nothing to do", () => {
    const items = attentionItems({
      uncategorized: 3,
      unconfirmed: [
        { account: account("a"), count: 2 },
        { account: account("b"), count: 0 },
      ],
      connections: [
        { state: "ok" },
        { state: "failed" },
        { state: "needs_owner" },
      ],
      today,
      statements: [],
      budgets: [],
      differences: [
        { account: account("a"), difference: money(-1500) },
        { account: account("b"), difference: undefined },
      ],
    });
    // A133: an account with a difference carries its unconfirmed count on that one row.
    expect(items.map((i) => [i.kind, i.count, i.account?.id])).toEqual([
      ["uncategorized", 3, undefined],
      ["connections", 2, undefined],
      ["difference", 1, "a"],
    ]);
    expect(items[2]?.unconfirmed).toBe(2);
  });

  it("keeps the statement of an account's earliest unconfirmed entry", () => {
    const items = attentionItems({
      uncategorized: 0,
      unconfirmed: [{ account: account("b"), count: 1, statementId: "s1" }],
      connections: [],
      today,
      statements: [],
      budgets: [],
      differences: [{ account: account("b"), difference: undefined }],
    });
    expect(items).toEqual([
      {
        kind: "unconfirmed",
        count: 1,
        account: account("b"),
        statementId: "s1",
      },
    ]);
  });

  it("ignores an open assertion whose difference is zero", () => {
    expect(
      attentionItems({
        uncategorized: 0,
        unconfirmed: [],
        connections: [],
        today,
        statements: [],
        budgets: [],
        differences: [{ account: account("a"), difference: money(0) }],
      }),
    ).toEqual([]);
  });

  it("is empty when nothing needs attention", () => {
    expect(
      attentionItems({
        uncategorized: 0,
        unconfirmed: [],
        connections: [{ state: "ok" }],
        today,
        statements: [],
        budgets: [],
        differences: [],
      }),
    ).toEqual([]);
  });

  // S247
  it("notices a card statement due within three days or overdue", () => {
    const items = attentionItems({
      today: "2026-11-10",
      uncategorized: 0,
      unconfirmed: [],
      connections: [],
      differences: [],
      budgets: [],
      statements: [
        {
          account: account("c"),
          unpaid: [
            statement("s09", "2026-11-09"),
            statement("s13", "2026-11-13"),
            statement("s14", "2026-11-14"),
          ],
        },
      ],
    });
    expect(
      items.map((i) => [i.kind, i.statement?.id, i.account?.id, i.overdue]),
    ).toEqual([
      ["statement_due", "s09", "c", true],
      ["statement_due", "s13", "c", false],
    ]);
    expect(items.map((i) => i.count)).toEqual([1, 1]);
  });

  // S248
  it("counts the budgets over their amount in one item", () => {
    const items = attentionItems({
      today,
      uncategorized: 0,
      unconfirmed: [],
      connections: [],
      differences: [],
      statements: [],
      budgets: [progress(1000, 1001), progress(1000, 900), progress(1000, 100)],
    });
    expect(items).toEqual([{ kind: "budget_over", count: 1 }]);
  });

  it("orders the kinds as uncategorized, unconfirmed, connections, statement, budget, difference", () => {
    const items = attentionItems({
      today,
      uncategorized: 1,
      unconfirmed: [{ account: account("u"), count: 1 }],
      connections: [{ state: "failed" }],
      differences: [{ account: account("d"), difference: money(-100) }],
      statements: [
        { account: account("c"), unpaid: [statement("s1", "2026-10-18")] },
      ],
      budgets: [progress(1000, 2000)],
    });
    expect(items.map((i) => i.kind)).toEqual([
      "uncategorized",
      "unconfirmed",
      "connections",
      "statement_due",
      "budget_over",
      "difference",
    ]);
  });
});
