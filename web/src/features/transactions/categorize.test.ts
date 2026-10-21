import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import {
  categoryParts,
  chunks,
  currentParts,
  similarSearch,
  summarizeBulk,
} from "@/features/transactions/categorize";

type Account = components["schemas"]["Account"];
type Transaction = components["schemas"]["Transaction"];

const money = (amount: number) => ({ amount, currency: "BRL" });

function account(id: string, cls: Account["class"]): Account {
  return {
    id,
    name: id,
    class: cls,
    currency: "BRL",
    opened_on: "2026-01-01",
    yield_mode: "none",
  };
}

const accounts = new Map(
  [
    account("checking", "asset"),
    account("food", "expense"),
    account("fun", "expense"),
  ].map((a) => [a.id, a]),
);

function tx(postings: [string, number][]): Transaction {
  return {
    id: "t1",
    date: "2026-10-10",
    description: "UBER *TRIP",
    balancing_currency: "BRL",
    origin: "import",
    version: 4,
    tags: [],
    links: [],
    postings: postings.map(([account_id, amount], i) => ({
      id: `p${String(i)}`,
      account_id,
      amount: money(amount),
      weight: money(amount),
      status: "cleared",
    })),
  };
}

describe("categoryParts", () => {
  it("puts the whole category total on the chosen category", () => {
    const split = tx([
      ["checking", -15000],
      ["food", 10000],
      ["fun", 5000],
    ]);
    expect(categoryParts(split, accounts, "fun")).toEqual([
      { account_id: "fun", amount: money(15000) },
    ]);
  });
});

describe("currentParts", () => {
  it("returns the category postings summed per category, for an undo", () => {
    const split = tx([
      ["checking", -15000],
      ["food", 10000],
      ["fun", 3000],
      ["fun", 2000],
    ]);
    expect(currentParts(split, accounts)).toEqual([
      { account_id: "food", amount: money(10000) },
      { account_id: "fun", amount: money(5000) },
    ]);
  });
});

describe("chunks", () => {
  it("splits a list into runs of at most the size", () => {
    expect(chunks([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunks([], 200)).toEqual([]);
  });
});

describe("summarizeBulk", () => {
  it("counts the categorized items and groups the refusals by status", () => {
    expect(
      summarizeBulk([
        { id: "a", status: "categorized", version: 2 },
        { id: "b", status: "version_conflict" },
        { id: "c", status: "categorized", version: 5 },
        { id: "d", status: "version_conflict" },
        { id: "e", status: "transaction_voided" },
      ]),
    ).toEqual({
      categorized: 2,
      refused: [
        { status: "version_conflict", count: 2 },
        { status: "transaction_voided", count: 1 },
      ],
    });
  });
});

describe("similarSearch", () => {
  it("looks for the same payee, else the same description", () => {
    expect(similarSearch({ ...tx([]), payee_id: "p1" })).toEqual({
      uncategorized: true,
      payee_id: "p1",
    });
    expect(similarSearch(tx([]))).toEqual({
      uncategorized: true,
      q: "UBER *TRIP",
    });
    expect(similarSearch({ ...tx([]), description: "" })).toBeNull();
  });
});
