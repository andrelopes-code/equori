import { describe, expect, it } from "vitest";

import { monthExpenses, monthRange } from "@/features/reports/net-worth-days";

describe("monthRange", () => {
  it.each([
    ["2026-10", "2026-11-04", "2026-10-01", "2026-10-31"],
    ["2026-11", "2026-11-04", "2026-11-01", "2026-11-04"],
    ["2028-02", "2028-03-10", "2028-02-01", "2028-02-29"],
  ])("reads %s on %s from %s to %s", (month, today, from, to) => {
    expect(monthRange(month, today)).toEqual({ from, to });
  });
});

describe("monthExpenses", () => {
  const brl = (amount: number) => ({ amount, currency: "BRL" });
  const categories = new Map([
    ["food", "Food"],
    ["travel", "Travel"],
  ]);
  const transactions = [
    {
      id: "t1",
      date: "2026-11-02",
      description: "Market",
      postings: [
        { account_id: "food", amount: brl(5000) },
        { account_id: "card", amount: brl(-5000) },
      ],
    },
    {
      id: "t2",
      date: "2026-11-02",
      description: "Market refund",
      postings: [
        { account_id: "food", amount: brl(-1000) },
        { account_id: "card", amount: brl(1000) },
      ],
    },
    {
      id: "t3",
      date: "2026-11-03",
      description: "Card statement",
      postings: [
        { account_id: "checking", amount: brl(-90000) },
        { account_id: "card", amount: brl(90000) },
      ],
    },
    {
      id: "t4",
      date: "2026-11-03",
      description: "Voided dinner",
      voided_at: "2026-11-04T10:00:00Z",
      postings: [
        { account_id: "food", amount: brl(8000) },
        { account_id: "card", amount: brl(-8000) },
      ],
    },
    {
      id: "t5",
      date: "2026-11-03",
      description: "Flight",
      postings: [
        { account_id: "travel", amount: brl(30000) },
        { account_id: "card", amount: brl(-30000) },
      ],
    },
    {
      id: "t6",
      date: "2026-11-04",
      description: "Abroad",
      postings: [
        { account_id: "travel", amount: { amount: 700, currency: "USD" } },
        { account_id: "card", amount: { amount: -700, currency: "USD" } },
      ],
    },
  ];

  it("lists the expense postings of the month, the largest first, a card purchase and a refund included", () => {
    const rows = monthExpenses(transactions, categories, "BRL", undefined);

    expect(rows).toEqual([
      {
        key: "t5-0",
        date: "2026-11-03",
        description: "Flight",
        category: "Travel",
        amount: 30000,
      },
      {
        key: "t1-0",
        date: "2026-11-02",
        description: "Market",
        category: "Food",
        amount: 5000,
      },
      {
        key: "t2-0",
        date: "2026-11-02",
        description: "Market refund",
        category: "Food",
        amount: -1000,
      },
    ]);
  });

  it("keeps the expenses of the day picked", () => {
    const rows = monthExpenses(transactions, categories, "BRL", "2026-11-02");

    expect(rows.map((row) => row.key)).toEqual(["t1-0", "t2-0"]);
  });
});
