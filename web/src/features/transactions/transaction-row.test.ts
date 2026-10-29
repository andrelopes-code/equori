import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import { transactionRow } from "@/features/transactions/transaction-row";

type Account = components["schemas"]["Account"];
type Transaction = components["schemas"]["Transaction"];

const accounts = new Map<string, Account>(
  (
    [
      ["card", "liability"],
      ["checking", "asset"],
      ["savings", "asset"],
      ["food", "expense"],
    ] satisfies [string, Account["class"]][]
  ).map(([id, accountClass]) => [
    id,
    { id, name: id, class: accountClass, currency: "BRL" },
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

describe("transactionRow", () => {
  it("names a card once for an installment purchase", () => {
    const purchase = tx(
      ["card", -1000],
      ["card", -1000],
      ["card", -1000],
      ["food", 3000],
    );

    const row = transactionRow(purchase, accounts, new Map());

    expect(row.accounts).toBe("card");
  });

  it("names each side of a transfer once", () => {
    const transfer = tx(
      ["checking", -500],
      ["checking", -500],
      ["savings", 1000],
    );

    const row = transactionRow(transfer, accounts, new Map());

    expect(row.accounts).toBe("checking → savings");
  });
});
