import { describe, expect, it } from "vitest";

import {
  entryTotals,
  monthEntries,
  monthRange,
} from "@/features/reports/net-worth-days";

describe("monthRange", () => {
  it.each([
    ["2026-10", "2026-11-04", "2026-10-01", "2026-10-31"],
    ["2026-11", "2026-11-04", "2026-11-01", "2026-11-04"],
    ["2028-02", "2028-03-10", "2028-02-01", "2028-02-29"],
  ])("reads %s on %s from %s to %s", (month, today, from, to) => {
    expect(monthRange(month, today)).toEqual({ from, to });
  });
});

describe("monthEntries", () => {
  const brl = (amount: number) => ({ amount, currency: "BRL" });
  const categories = new Map([
    ["food", { name: "Food", kind: "expense" as const }],
    ["travel", { name: "Travel", kind: "expense" as const }],
    ["salary", { name: "Salary", kind: "income" as const }],
  ]);
  const transactions = [
    {
      id: "t0",
      date: "2026-11-01",
      description: "Payroll",
      postings: [
        { account_id: "salary", amount: brl(-20000) },
        { account_id: "checking", amount: brl(20000) },
      ],
    },
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

  it("lists the income and expenses of the month by their effect on net worth, the largest first", () => {
    const rows = monthEntries(transactions, categories, "BRL", undefined);

    expect(rows).toEqual([
      {
        key: "t5-0",
        date: "2026-11-03",
        description: "Flight",
        category: "Travel",
        kind: "expense",
        amount: -30000,
      },
      {
        key: "t0-0",
        date: "2026-11-01",
        description: "Payroll",
        category: "Salary",
        kind: "income",
        amount: 20000,
      },
      {
        key: "t1-0",
        date: "2026-11-02",
        description: "Market",
        category: "Food",
        kind: "expense",
        amount: -5000,
      },
      {
        key: "t2-0",
        date: "2026-11-02",
        description: "Market refund",
        category: "Food",
        kind: "expense",
        amount: 1000,
      },
    ]);
  });

  it("keeps the entries of the day picked", () => {
    const rows = monthEntries(transactions, categories, "BRL", "2026-11-02");

    expect(rows.map((row) => row.key)).toEqual(["t1-0", "t2-0"]);
  });
});

describe("entryTotals", () => {
  it("adds the income, the expenses and their result, a refund lowering the expenses", () => {
    const row = (amount: number, kind: "income" | "expense") => ({
      key: String(amount),
      date: "2026-11-02",
      description: "",
      category: "",
      kind,
      amount,
    });

    const totals = entryTotals([
      row(20000, "income"),
      row(-5000, "expense"),
      row(1000, "expense"),
      row(-30000, "expense"),
    ]);

    expect(totals).toEqual({ income: 20000, expense: 34000, net: -14000 });
  });
});
