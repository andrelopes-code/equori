import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import { rowAmount } from "@/features/transactions/row-amount";

type Account = components["schemas"]["Account"];
type Transaction = components["schemas"]["Transaction"];

const accounts = new Map<string, Account>(
  (
    [
      ["checking", "asset"],
      ["savings", "asset"],
      ["food", "expense"],
      ["salary", "income"],
      ["yield", "income"],
      ["interest", "income", "yield"],
    ] satisfies [string, Account["class"], string?][]
  ).map(([id, accountClass, parentID]) => [
    id,
    {
      id,
      name: id,
      class: accountClass,
      currency: "BRL",
      ...(parentID === undefined ? {} : { parent_id: parentID }),
    },
  ]),
);

function tx(...postings: [string, number][]): Transaction {
  return {
    id: "t1",
    date: "2026-10-17",
    description: "",
    balancing_currency: "BRL",
    origin: "manual",
    version: 1,
    tags: [],
    links: [],
    postings: postings.map(([accountID, amount], i) => ({
      id: `p${String(i)}`,
      account_id: accountID,
      amount: { amount, currency: "BRL" },
    })),
  };
}

describe("rowAmount", () => {
  const expense = tx(["checking", -12000], ["food", 12000]);

  it("sums the balance-account postings of an expense", () => {
    expect(rowAmount(expense, accounts)).toEqual({
      money: { amount: -12000, currency: "BRL" },
      transfer: false,
    });
  });

  it("shows a category filter as the outflow of an expense", () => {
    expect(rowAmount(expense, accounts, "food")).toEqual({
      money: { amount: -12000, currency: "BRL" },
      transfer: false,
    });
  });

  it("takes the filtered balance account posting", () => {
    expect(rowAmount(expense, accounts, "checking")).toEqual({
      money: { amount: -12000, currency: "BRL" },
      transfer: false,
    });
  });

  it("shows a category filter as the inflow of an income", () => {
    const income = tx(["interest", -419], ["checking", 419]);
    expect(rowAmount(income, accounts, "interest").money.amount).toBe(419);
  });

  it("sums the descendants of the filtered category", () => {
    const income = tx(["interest", -419], ["checking", 419]);
    expect(rowAmount(income, accounts, "yield").money.amount).toBe(419);
  });

  it("shows the outflow side of a transfer", () => {
    expect(
      rowAmount(tx(["checking", -50000], ["savings", 50000]), accounts),
    ).toEqual({ money: { amount: -50000, currency: "BRL" }, transfer: true });
  });

  it("shows the inflow of an income", () => {
    expect(
      rowAmount(tx(["salary", -100000], ["checking", 100000]), accounts),
    ).toEqual({ money: { amount: 100000, currency: "BRL" }, transfer: false });
  });
});
