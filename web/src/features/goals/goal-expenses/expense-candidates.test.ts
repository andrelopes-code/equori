import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import { expenseCandidates } from "@/features/goals/goal-expenses/expense-candidates";

type Account = components["schemas"]["Account"];
type Transaction = components["schemas"]["Transaction"];

const brl = (amount: number) => ({ amount, currency: "BRL" });
const accounts = new Map(
  [
    { id: "checking", class: "asset" },
    { id: "travel", class: "expense" },
    { id: "food", class: "expense" },
    { id: "savings", class: "asset" },
  ].map((a) => [a.id, a as Account]),
);

function tx(
  id: string,
  date: string,
  postings: [string, number][],
  voided = false,
): Transaction {
  return {
    id,
    date,
    description: id,
    postings: postings.map(([account_id, amount]) => ({
      account_id,
      amount: brl(amount),
    })),
    ...(voided ? { voided_at: "2026-10-09T00:00:00Z" } : {}),
  } as unknown as Transaction;
}

describe("expenseCandidates", () => {
  const transactions = [
    tx("flight", "2026-10-06", [
      ["travel", 300000],
      ["checking", -300000],
    ]),
    tx("dinner", "2026-10-08", [
      ["travel", 5000],
      ["food", 7000],
      ["checking", -12000],
    ]),
    tx("transfer", "2026-10-07", [
      ["savings", 1000],
      ["checking", -1000],
    ]),
    tx(
      "voided",
      "2026-10-09",
      [
        ["travel", 100],
        ["checking", -100],
      ],
      true,
    ),
    tx("hotel", "2026-10-08", [
      ["travel", 200000],
      ["checking", -200000],
    ]),
  ];

  it("keeps the transactions with an expense posting, the latest first", () => {
    const got = expenseCandidates(transactions, accounts, new Set());

    expect(got.map((c) => [c.id, c.money.amount])).toEqual([
      ["hotel", 200000],
      ["dinner", 12000],
      ["flight", 300000],
    ]);
  });

  it("leaves out what the goal already pays", () => {
    const got = expenseCandidates(transactions, accounts, new Set(["flight"]));

    expect(got.map((c) => c.id)).toEqual(["hotel", "dinner"]);
  });
});
