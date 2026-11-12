import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import { transactionTitle } from "@/features/transactions/model/transaction-title";
import { catalogPtBR } from "@/i18n/catalog.pt-BR";
import type { TFunction } from "@/i18n/i18n-provider";

type Transaction = components["schemas"]["Transaction"];

const t: TFunction = (key, vars) =>
  Object.entries(vars ?? {}).reduce(
    (text, [name, value]) => text.replace(`{${name}}`, String(value)),
    catalogPtBR[key],
  );

const holdingID = "holding";

const accounts = new Map([[holdingID, { currency: "AUVP11" }]]);

function tx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "t1",
    date: "2026-10-17",
    description: "",
    balancing_currency: "BRL",
    origin: "manual",
    version: 1,
    tags: [],
    links: [],
    postings: [],
    ...overrides,
  };
}

function trade(side: "buy" | "sell"): Transaction {
  const money = { amount: 10, currency: "BRL" };
  return tx({
    trade: {
      account_id: holdingID,
      cash_account_id: "cash",
      side,
      quantity: { amount: 10, currency: "AUVP11" },
      unit_price: "10",
      gross: money,
      fees: money,
      taxes: money,
    },
  });
}

function income(): Transaction {
  const money = { amount: 10, currency: "BRL" };
  return tx({
    investment_income: {
      account_id: holdingID,
      cash_account_id: "cash",
      income_type: "dividend",
      gross: money,
      withheld: money,
    },
  });
}

describe("transactionTitle", () => {
  it("titles a purchase with an empty description", () => {
    expect(transactionTitle(trade("buy"), t)).toBe("Compra de AUVP11");
  });

  it("titles a sale with an empty description", () => {
    expect(transactionTitle(trade("sell"), t)).toBe("Venda de AUVP11");
  });

  it("titles an income with the currency of the holding account", () => {
    expect(transactionTitle(income(), t, { accounts })).toBe(
      "Provento de AUVP11",
    );
  });

  it("returns empty for an income whose holding account is unknown", () => {
    expect(transactionTitle(income(), t)).toBe("");
  });

  it("keeps a non-empty description", () => {
    const bought = { ...trade("buy"), description: "Aporte de outubro" };

    expect(transactionTitle(bought, t)).toBe("Aporte de outubro");
  });

  it("keeps the payee over the description and the derived title", () => {
    expect(transactionTitle(trade("buy"), t, { payee: "Corretora" })).toBe(
      "Corretora",
    );
  });

  it("returns empty for an expense with an empty description", () => {
    expect(transactionTitle(tx(), t)).toBe("");
  });
});
