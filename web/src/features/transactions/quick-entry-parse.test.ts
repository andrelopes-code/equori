import { describe, expect, it } from "vitest";

import {
  parseEntry,
  type EntryContext,
  type EntryParse,
} from "@/features/transactions/quick-entry-parse";

// Complete frontend decision F2.
const accounts: EntryContext["accounts"] = [
  { id: "itau", name: "Itaú", class: "asset", kind: "checking" },
  { id: "nubank", name: "Nubank", class: "liability", kind: "credit_card" },
  { id: "wallet", name: "Carteira", class: "asset", kind: "cash" },
  { id: "restaurants", name: "Restaurantes", class: "expense" },
  { id: "transport", name: "Transporte", class: "expense" },
  { id: "market", name: "Mercado", class: "expense" },
  { id: "income", name: "Renda", class: "income" },
];

const ctx: EntryContext = { today: "2026-10-17", scale: 2, accounts };

describe("parseEntry", () => {
  const cases: { name: string; text: string; want: EntryParse }[] = [
    {
      name: "lunch yesterday",
      text: "almoço 42 ontem",
      want: {
        amount: 4200,
        date: "2026-10-16",
        dateWord: "yesterday",
        mode: "expense",
        accountId: "itau",
        categoryId: "restaurants",
        description: "Almoço",
      },
    },
    {
      name: "ride on the card with a decimal comma",
      text: "uber 23,90 cartão",
      want: {
        amount: 2390,
        date: "2026-10-17",
        dateWord: null,
        mode: "expense",
        accountId: "nubank",
        categoryId: "transport",
        description: "Uber",
      },
    },
    {
      name: "income",
      text: "recebi freela 1200",
      want: {
        amount: 120000,
        date: "2026-10-17",
        dateWord: null,
        mode: "income",
        accountId: "itau",
        categoryId: "income",
        description: "Freela",
      },
    },
    {
      name: "no number",
      text: "mercado hoje",
      want: {
        amount: null,
        date: "2026-10-17",
        dateWord: "today",
        mode: "expense",
        accountId: "itau",
        categoryId: "market",
        description: "Mercado",
      },
    },
    {
      name: "two days ago",
      text: "jantar 80 anteontem",
      want: {
        amount: 8000,
        date: "2026-10-15",
        dateWord: "before",
        mode: "expense",
        accountId: "itau",
        categoryId: "restaurants",
        description: "Jantar",
      },
    },
    {
      name: "cash account",
      text: "lanche 15 dinheiro",
      want: {
        amount: 1500,
        date: "2026-10-17",
        dateWord: null,
        mode: "expense",
        accountId: "wallet",
        categoryId: "restaurants",
        description: "Lanche",
      },
    },
    {
      name: "thousands dot and decimal comma",
      text: "mercado 1.200,50",
      want: {
        amount: 120050,
        date: "2026-10-17",
        dateWord: null,
        mode: "expense",
        accountId: "itau",
        categoryId: "market",
        description: "Mercado",
      },
    },
    {
      name: "decimal dot, English words and connectors",
      text: "Lunch on 23.90 yesterday with card",
      want: {
        amount: 2390,
        date: "2026-10-16",
        dateWord: "yesterday",
        mode: "expense",
        accountId: "nubank",
        categoryId: "restaurants",
        description: "Lunch",
      },
    },
    {
      name: "category named by a word of the text",
      text: "transporte 10",
      want: {
        amount: 1000,
        date: "2026-10-17",
        dateWord: null,
        mode: "expense",
        accountId: "itau",
        categoryId: "transport",
        description: "Transporte",
      },
    },
    {
      name: "unknown word",
      text: "xyzzy 10",
      want: {
        amount: 1000,
        date: "2026-10-17",
        dateWord: null,
        mode: "expense",
        accountId: "itau",
        categoryId: null,
        description: "Xyzzy",
      },
    },
    {
      name: "empty text",
      text: "",
      want: {
        amount: null,
        date: "2026-10-17",
        dateWord: null,
        mode: "expense",
        accountId: "itau",
        categoryId: null,
        description: "",
      },
    },
  ];

  it.each(cases)("parses $name", ({ text, want }) => {
    expect(parseEntry(text, ctx)).toEqual(want);
  });

  it("prefers a history match over the keyword table", () => {
    const withHistory: EntryContext = {
      ...ctx,
      history: [{ description: "Uber", categoryId: "restaurants" }],
    };
    expect(parseEntry("uber 23,90", withHistory).categoryId).toBe(
      "restaurants",
    );
    expect(parseEntry("uber 23,90", ctx).categoryId).toBe("transport");
  });

  it("ignores a history category of the wrong class", () => {
    const withHistory: EntryContext = {
      ...ctx,
      history: [{ description: "Freela", categoryId: "restaurants" }],
    };
    expect(parseEntry("recebi freela 1200", withHistory).categoryId).toBe(
      "income",
    );
  });

  it("returns a null account when no balance account is open", () => {
    const onlyCategories: EntryContext = {
      ...ctx,
      accounts: accounts.filter((a) => a.class === "expense"),
    };
    expect(parseEntry("almoço 42", onlyCategories).accountId).toBeNull();
  });

  it("falls back to the first asset account when none is checking", () => {
    const noChecking: EntryContext = {
      ...ctx,
      accounts: accounts.filter((a) => a.id !== "itau"),
    };
    expect(parseEntry("almoço 42", noChecking).accountId).toBe("wallet");
  });

  it("posts to the default account unless an account word names another", () => {
    const onCard: EntryContext = { ...ctx, defaultAccountId: "nubank" };
    expect(parseEntry("almoço 42", onCard).accountId).toBe("nubank");
    expect(parseEntry("almoço 42 dinheiro", onCard).accountId).toBe("wallet");
  });
});
