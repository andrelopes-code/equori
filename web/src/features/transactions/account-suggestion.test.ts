import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import { suggestAccount } from "@/features/transactions/account-suggestion";

type Transaction = components["schemas"]["Transaction"];

function spent(id: number, from: string): Transaction {
  return {
    id: `t${String(id)}`,
    date: "2026-10-01",
    description: "Mercado",
    balancing_currency: "BRL",
    origin: "manual",
    version: 1,
    tags: [],
    links: [],
    postings: [
      {
        id: `p${String(id)}a`,
        account_id: "food",
        amount: { amount: 1000, currency: "BRL" },
      },
      {
        id: `p${String(id)}b`,
        account_id: from,
        amount: { amount: -1000, currency: "BRL" },
      },
    ],
  };
}

const candidates = new Set(["nubank", "itau", "visa"]);
const history = (accounts: string[]) => accounts.map((a, i) => spent(i, a));

describe("suggestAccount", () => {
  it.each<[string, string[], ReturnType<typeof suggestAccount>]>([
    [
      "8 of the last 10",
      [
        "visa",
        "visa",
        "nubank",
        "visa",
        "visa",
        "visa",
        "itau",
        "visa",
        "visa",
        "visa",
      ],
      { accountId: "visa", count: 8, total: 10 },
    ],
    [
      "6 of 10 reaches 60 %",
      [
        "visa",
        "visa",
        "visa",
        "visa",
        "visa",
        "visa",
        "itau",
        "itau",
        "nubank",
        "nubank",
      ],
      { accountId: "visa", count: 6, total: 10 },
    ],
    [
      "5 of 10 is below 60 %",
      [
        "visa",
        "visa",
        "visa",
        "visa",
        "visa",
        "itau",
        "itau",
        "itau",
        "nubank",
        "nubank",
      ],
      null,
    ],
    ["2 of 2 is too few", ["visa", "visa"], null],
    [
      "3 of 3",
      ["visa", "visa", "visa"],
      { accountId: "visa", count: 3, total: 3 },
    ],
    [
      "only the last 10 count",
      [
        "itau",
        "itau",
        "itau",
        "itau",
        "itau",
        "itau",
        "itau",
        "visa",
        "visa",
        "visa",
        "visa",
        "visa",
      ],
      { accountId: "itau", count: 7, total: 10 },
    ],
    [
      "accounts outside the candidates are skipped",
      ["closed", "closed", "visa", "visa", "visa"],
      { accountId: "visa", count: 3, total: 3 },
    ],
    ["no history", [], null],
  ])("%s", (_, accounts, want) => {
    expect(suggestAccount(history(accounts), candidates)).toEqual(want);
  });
});
