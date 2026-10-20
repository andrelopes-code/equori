import { describe, expect, it } from "vitest";

import {
  balanceTotals,
  monthFlows,
  statementMonths,
} from "@/features/admin/overview-math";

const BRL = (amount: number) => ({ amount, currency: "BRL" });

describe("balanceTotals", () => {
  it("adds asset and liability balances by currency and nets them", () => {
    const classOf = new Map([
      ["a1", "asset"],
      ["a2", "asset"],
      ["l1", "liability"],
    ]);
    expect(
      balanceTotals(
        [
          { account_id: "a1", balance: BRL(10000) },
          { account_id: "a2", balance: { amount: 500, currency: "USD" } },
          { account_id: "l1", balance: BRL(-2500) },
          { account_id: "unknown", balance: BRL(99) },
        ],
        classOf,
      ),
    ).toEqual([
      { currency: "BRL", asset: 10000, liability: -2500, net: 7500 },
      { currency: "USD", asset: 500, liability: 0, net: 500 },
    ]);
  });
});

describe("monthFlows", () => {
  const classOf = new Map([
    ["food", "expense"],
    ["salary", "income"],
    ["checking", "asset"],
  ]);
  const tx = (
    voided: boolean,
    postings: { account_id: string; amount: number }[],
  ) => ({
    ...(voided ? { voided_at: "2026-10-02T10:00:00Z" } : {}),
    postings: postings.map((p) => ({
      account_id: p.account_id,
      amount: BRL(p.amount),
    })),
  });

  it("totals income and expense postings by account, skipping voided transactions", () => {
    expect(
      monthFlows(
        [
          tx(false, [
            { account_id: "food", amount: 4500 },
            { account_id: "checking", amount: -4500 },
          ]),
          tx(false, [
            { account_id: "food", amount: 1500 },
            { account_id: "checking", amount: -1500 },
          ]),
          tx(false, [
            { account_id: "salary", amount: -900000 },
            { account_id: "checking", amount: 900000 },
          ]),
          tx(true, [
            { account_id: "food", amount: 100000 },
            { account_id: "checking", amount: -100000 },
          ]),
        ],
        classOf,
      ),
    ).toEqual({
      accounts: [
        { account_id: "food", class: "expense", total: BRL(6000), postings: 2 },
        {
          account_id: "salary",
          class: "income",
          total: BRL(-900000),
          postings: 1,
        },
      ],
      totals: [
        { currency: "BRL", income: 900000, expense: 6000, result: 894000 },
      ],
    });
  });
});

describe("statementMonths", () => {
  const statement = (reference: string, due: number, paid: number) => ({
    reference,
    opening: BRL(0),
    charges: BRL(due),
    credits: BRL(0),
    amount_due: BRL(due),
    payments: BRL(paid),
    unpaid: BRL(due - paid),
  });

  it("adds every card's statement of a reference, newest reference first", () => {
    expect(
      statementMonths([
        statement("2026-10", 10000, 10000),
        statement("2026-11", 20000, 0),
        statement("2026-11", 5000, 1000),
      ]),
    ).toEqual([
      {
        reference: "2026-11",
        statements: 2,
        opening: BRL(0),
        charges: BRL(25000),
        credits: BRL(0),
        amount_due: BRL(25000),
        payments: BRL(1000),
        unpaid: BRL(24000),
      },
      {
        reference: "2026-10",
        statements: 1,
        opening: BRL(0),
        charges: BRL(10000),
        credits: BRL(0),
        amount_due: BRL(10000),
        payments: BRL(10000),
        unpaid: BRL(0),
      },
    ]);
  });
});
