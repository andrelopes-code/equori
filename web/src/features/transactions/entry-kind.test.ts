import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import {
  draftFromTransaction,
  emptyDraft,
  imbalance,
  inputFromDraft,
} from "@/features/transactions/entry-kind";

type Account = components["schemas"]["Account"];
type Transaction = components["schemas"]["Transaction"];

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
    account("savings", "asset"),
    account("food", "expense"),
    account("salary", "income"),
  ].map((a) => [a.id, a]),
);

const money = (amount: number) => ({ amount, currency: "BRL" });

function tx(
  postings: [string, number][],
  extra: Partial<Transaction> = {},
): Transaction {
  return {
    id: "t",
    date: "2026-10-10",
    description: "Shop",
    balancing_currency: "BRL",
    origin: "manual",
    version: 2,
    tags: ["food"],
    links: [],
    postings: postings.map(([account_id, amount], i) => ({
      id: String(i),
      account_id,
      amount: money(amount),
      weight: money(amount),
      status: "cleared",
    })),
    ...extra,
  };
}

describe("inputFromDraft", () => {
  it("writes an expense as money out of the account into the category", () => {
    const draft = {
      ...emptyDraft("2026-10-10"),
      kind: "expense" as const,
      amount: 12000,
      accountId: "checking",
      categoryId: "food",
      payeeId: "p1",
      description: " Shop ",
      tags: ["food"],
    };
    expect(inputFromDraft(draft, accounts, "BRL")).toEqual({
      date: "2026-10-10",
      description: "Shop",
      payee_id: "p1",
      tags: ["food"],
      postings: [
        { account_id: "checking", amount: money(-12000) },
        { account_id: "food", amount: money(12000) },
      ],
    });
  });

  it("writes income and a transfer with the signs of their direction", () => {
    const income = {
      ...emptyDraft("2026-10-10"),
      kind: "income" as const,
      amount: 500,
      accountId: "checking",
      categoryId: "salary",
    };
    expect(inputFromDraft(income, accounts, "BRL").postings).toEqual([
      { account_id: "checking", amount: money(500) },
      { account_id: "salary", amount: money(-500) },
    ]);
    const transfer = {
      ...emptyDraft("2026-10-10"),
      kind: "transfer" as const,
      amount: 700,
      accountId: "checking",
      toAccountId: "savings",
    };
    expect(inputFromDraft(transfer, accounts, "BRL").postings).toEqual([
      { account_id: "checking", amount: money(-700) },
      { account_id: "savings", amount: money(700) },
    ]);
  });

  it("writes advanced rows as they are, with their memos", () => {
    const draft = {
      ...emptyDraft("2026-10-10"),
      kind: "advanced" as const,
      rows: [
        { accountId: "checking", amount: -900, memo: "" },
        { accountId: "food", amount: 900, memo: "lunch" },
      ],
    };
    expect(inputFromDraft(draft, accounts, "BRL").postings).toEqual([
      { account_id: "checking", amount: money(-900) },
      { account_id: "food", amount: money(900), memo: "lunch" },
    ]);
  });
});

describe("imbalance", () => {
  it("sums the advanced rows", () => {
    expect(
      imbalance([
        { accountId: "a", amount: -900, memo: "" },
        { accountId: "b", amount: 800, memo: "" },
      ]),
    ).toBe(-100);
  });
});

describe("draftFromTransaction", () => {
  // A136: a correction shows the statement the card posting is billed on.
  it("reads the statement of a card expense back", () => {
    const purchase = tx([
      ["checking", -713],
      ["food", 713],
    ]);
    const [card, category] = purchase.postings;
    if (card === undefined || category === undefined)
      throw new Error("postings");
    const draft = draftFromTransaction(
      { ...purchase, postings: [{ ...card, statement: "2026-12" }, category] },
      accounts,
    );

    expect(draft.statement).toBe("2026-12");
  });

  it("reads the three simple shapes back", () => {
    expect(
      draftFromTransaction(
        tx(
          [
            ["checking", -12000],
            ["food", 12000],
          ],
          { payee_id: "p1" },
        ),
        accounts,
      ),
    ).toMatchObject({
      kind: "expense",
      amount: 12000,
      accountId: "checking",
      categoryId: "food",
      payeeId: "p1",
      description: "Shop",
      tags: ["food"],
    });
    expect(
      draftFromTransaction(
        tx([
          ["checking", 500],
          ["salary", -500],
        ]),
        accounts,
      ),
    ).toMatchObject({
      kind: "income",
      amount: 500,
    });
    expect(
      draftFromTransaction(
        tx([
          ["checking", -700],
          ["savings", 700],
        ]),
        accounts,
      ),
    ).toMatchObject({
      kind: "transfer",
      amount: 700,
      accountId: "checking",
      toAccountId: "savings",
    });
  });

  it("opens any other shape in the advanced editor", () => {
    const split = tx([
      ["checking", -900],
      ["food", 600],
      ["salary", 300],
    ]);
    expect(draftFromTransaction(split, accounts)).toMatchObject({
      kind: "advanced",
      rows: [
        { accountId: "checking", amount: -900, memo: "" },
        { accountId: "food", amount: 600, memo: "" },
        { accountId: "salary", amount: 300, memo: "" },
      ],
    });
  });
});
