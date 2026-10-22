import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import {
  allocationTotals,
  expenseState,
  fillAllocation,
  reimbursementState,
} from "@/features/transactions/reimbursement";

type Account = components["schemas"]["Account"];
type Transaction = components["schemas"]["Transaction"];

const accounts = new Map<string, Account>(
  (
    [
      { id: "bank", class: "asset", kind: "checking" },
      { id: "income", class: "income", system_role: "uncategorized_income" },
      { id: "salary", class: "income" },
      { id: "food", class: "expense" },
      { id: "savings", class: "asset", kind: "savings" },
    ] as unknown as Account[]
  ).map((a) => [a.id, a]),
);

function tx(...postings: [string, number][]): Transaction {
  return {
    postings: postings.map(([account_id, amount]) => ({
      account_id,
      amount: { amount, currency: "BRL" },
    })),
  } as unknown as Transaction;
}

describe("reimbursementState", () => {
  it.each([
    {
      name: "an uncategorized inflow",
      tx: tx(["bank", 1500], ["income", -1500]),
      want: { inflow: true, uncategorized: true, amount: 1500 },
    },
    {
      name: "an inflow categorized as income",
      tx: tx(["bank", 1500], ["salary", -1500]),
      want: { inflow: true, uncategorized: false, amount: 1500 },
    },
    {
      name: "an inflow already netted against an expense",
      tx: tx(["bank", 1500], ["food", -1500]),
      want: { inflow: true, uncategorized: false, amount: 1500 },
    },
    {
      name: "an outflow",
      tx: tx(["bank", -1500], ["food", 1500]),
      want: { inflow: false, uncategorized: false, amount: 0 },
    },
    {
      name: "a transfer",
      tx: tx(["bank", 1500], ["savings", -1500]),
      want: { inflow: false, uncategorized: false, amount: 0 },
    },
  ])("reads $name", ({ tx: transaction, want }) => {
    expect(reimbursementState(transaction, accounts)).toEqual(want);
  });
});

describe("fillAllocation", () => {
  it.each([
    { remaining: 5000, unallocated: 10000, want: 5000 },
    { remaining: 8000, unallocated: 3000, want: 3000 },
    { remaining: 5000, unallocated: 0, want: 0 },
    { remaining: 5000, unallocated: -200, want: 0 },
  ])(
    "takes $want of $remaining with $unallocated unallocated",
    ({ remaining, unallocated, want }) => {
      expect(fillAllocation(remaining, unallocated)).toBe(want);
    },
  );
});

describe("allocationTotals", () => {
  it("adds up the checked rows and leaves the rest", () => {
    const rows = [
      { checked: true, amount: 5000 },
      { checked: true, amount: 2000 },
      { checked: false, amount: 9000 },
    ];
    expect(allocationTotals(rows, 10000)).toEqual({
      allocated: 7000,
      leftover: 3000,
    });
  });

  it("reports an over-allocation as a negative leftover", () => {
    expect(allocationTotals([{ checked: true, amount: 1200 }], 1000)).toEqual({
      allocated: 1200,
      leftover: -200,
    });
  });
});

describe("expenseState", () => {
  const withRefs = (
    transaction: Transaction,
    refs: { type: string; amount?: number }[],
    voided = false,
  ): Transaction =>
    ({
      ...transaction,
      ...(voided ? { voided_at: "2026-10-20T00:00:00Z" } : {}),
      referenced_by: refs.map((ref) => ({
        type: ref.type,
        source: "x",
        ...(ref.amount === undefined
          ? {}
          : { amount: { amount: ref.amount, currency: "BRL" } }),
      })),
    }) as unknown as Transaction;

  it.each([
    {
      name: "an expense nobody repaid",
      tx: withRefs(tx(["bank", -5000], ["food", 5000]), []),
      want: { expense: true, remaining: 5000 },
    },
    {
      name: "an expense partly repaid",
      tx: withRefs(tx(["bank", -5000], ["food", 5000]), [
        { type: "reimbursement_of", amount: 1000 },
        { type: "reimbursement_of", amount: 500 },
        { type: "refund_of" },
      ]),
      want: { expense: true, remaining: 3500 },
    },
    {
      name: "an expense repaid in full",
      tx: withRefs(tx(["bank", -5000], ["food", 5000]), [
        { type: "reimbursement_of", amount: 5000 },
      ]),
      want: { expense: true, remaining: 0 },
    },
    {
      name: "an inflow",
      tx: withRefs(tx(["bank", 1500], ["income", -1500]), []),
      want: { expense: false, remaining: 0 },
    },
    {
      name: "a voided expense",
      tx: withRefs(tx(["bank", -5000], ["food", 5000]), [], true),
      want: { expense: false, remaining: 5000 },
    },
  ])("reads $name", ({ tx: transaction, want }) => {
    expect(expenseState(transaction, accounts)).toEqual(want);
  });
});
