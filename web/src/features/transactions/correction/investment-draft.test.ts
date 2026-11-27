import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import {
  incomeDraftOf,
  tradeDraftOf,
} from "@/features/transactions/correction/investment-draft";

type Account = components["schemas"]["Account"];
type Transaction = components["schemas"]["Transaction"];

describe("tradeDraftOf", () => {
  it("fills the trade form from a stored purchase", () => {
    expect(tradeDraftOf(buy, accounts)).toEqual({
      side: "buy",
      brokerageId: "broker",
      instrument: "MXRF11",
      cashAccountId: "cash",
      date: "2026-10-05",
      settlementDate: "2026-10-07",
      quantity: 150,
      unitPrice: "10.05",
      priceBasis: "unit",
      total: 0,
      fees: 490,
      taxes: 0,
      taxesCategoryId: null,
      exchangeRate: null,
      description: "XP",
    });
  });

  // FC11: the stored rate stands unless the user changes it.
  it("keeps the exchange rate of a stored trade", () => {
    const foreign = trade({ exchange_rate: "5.2" }, [
      post("cash", -151240),
      post("sec", 150),
    ]);

    expect(tradeDraftOf(foreign, accounts)).toMatchObject({
      exchangeRate: "5.2",
    });
  });

  it("fills the form of an opening without cash or settlement", () => {
    const opening = trade(
      { side: "opening", cash_account_id: "sec", settlement_date: undefined },
      [post("sec", 150), post("equity", -150)],
    );

    expect(tradeDraftOf(opening, accounts)).toMatchObject({
      side: "opening",
      cashAccountId: null,
      settlementDate: null,
    });
  });

  it.each([
    {
      name: "a chosen category before the security posting",
      postings: [post("cash", 52000), post("irrf", 300), post("sec", -50)],
      want: "irrf",
    },
    {
      name: "a loss of the same amount after the security posting",
      postings: [
        post("cash", 52000),
        post("irrf", 300),
        post("sec", -50),
        post("losses", 300),
      ],
      want: "irrf",
    },
    {
      name: "the system taxes account, which the server applies by default",
      postings: [post("cash", 52000), post("taxes", 300), post("sec", -50)],
      want: null,
    },
  ])("reads the taxes category of a sale: $name", ({ postings, want }) => {
    const sale = trade({ side: "sell", taxes: brl(300) }, postings);

    expect(tradeDraftOf(sale, accounts)?.taxesCategoryId).toBe(want);
  });

  it("returns null for a transaction without a trade", () => {
    expect(tradeDraftOf(dividend, accounts)).toBeNull();
  });
});

describe("incomeDraftOf", () => {
  it("keeps the exchange rate of a stored income, null when none", () => {
    const stored = {
      ...dividend,
      investment_income: {
        ...dividend.investment_income,
        exchange_rate: "5.2",
      },
    } as unknown as Transaction;

    expect(incomeDraftOf(stored, accounts)).toMatchObject({
      exchangeRate: "5.2",
    });
    expect(incomeDraftOf(dividend, accounts)).toMatchObject({
      exchangeRate: null,
    });
  });

  it.each([
    {
      name: "a withheld amount on a chosen category",
      postings: [post("cash", 1400), post("irrf", 100), post("divs", -1500)],
      withheld: 100,
      want: { categoryId: "divs", withheldCategoryId: "irrf" },
    },
    {
      name: "nothing withheld",
      postings: [post("cash", 1500), post("divs", -1500)],
      withheld: 0,
      want: { categoryId: "divs", withheldCategoryId: null },
    },
    {
      name: "a withheld amount on the system taxes account",
      postings: [post("cash", 1400), post("taxes", 100), post("divs", -1500)],
      withheld: 100,
      want: { categoryId: "divs", withheldCategoryId: null },
    },
  ])("fills the income form: $name", ({ postings, withheld, want }) => {
    const income = {
      ...dividend,
      postings,
      investment_income: {
        ...dividend.investment_income,
        withheld: brl(withheld),
      },
    } as Transaction;

    expect(incomeDraftOf(income, accounts)).toEqual({
      brokerageId: "broker",
      instrument: "MXRF11",
      cashAccountId: "cash",
      date: "2026-10-26",
      incomeType: "dividend",
      gross: 1500,
      withheld,
      exchangeRate: null,
      description: "",
      ...want,
    });
  });

  it("returns null for a transaction without an income", () => {
    expect(incomeDraftOf(buy, accounts)).toBeNull();
  });
});

const accounts = [
  { id: "broker", name: "XP", class: "asset", currency: "BRL" },
  {
    id: "cash",
    name: "XP cash",
    class: "asset",
    currency: "BRL",
    parent_id: "broker",
  },
  {
    id: "sec",
    name: "XP MXRF11",
    class: "asset",
    currency: "MXRF11",
    parent_id: "broker",
  },
  { id: "irrf", name: "IRRF", class: "expense", currency: "BRL" },
  {
    id: "taxes",
    name: "Taxes",
    class: "expense",
    currency: "BRL",
    system_role: "taxes",
  },
  { id: "divs", name: "Dividends", class: "income", currency: "BRL" },
] as Account[];

function brl(amount: number) {
  return { amount, currency: "BRL" };
}

function post(account: string, amount: number) {
  const money =
    account === "sec"
      ? { amount, currency: "MXRF11" }
      : { amount, currency: "BRL" };

  return {
    id: account,
    account_id: account,
    amount: money,
    weight: brl(amount),
    status: "cleared",
  };
}

function trade(
  detail: Record<string, unknown>,
  postings: ReturnType<typeof post>[],
): Transaction {
  return {
    id: "t1",
    date: "2026-10-05",
    description: "XP",
    balancing_currency: "BRL",
    version: 1,
    postings,
    trade: {
      account_id: "sec",
      cash_account_id: "cash",
      side: "buy",
      quantity: { amount: 150, currency: "MXRF11" },
      unit_price: "10.05",
      settlement_date: "2026-10-07",
      gross: brl(150750),
      fees: brl(490),
      taxes: brl(0),
      ...detail,
    },
  } as unknown as Transaction;
}

const buy = trade({}, [post("cash", -151240), post("sec", 150)]);

const dividend = {
  id: "t2",
  date: "2026-10-26",
  description: "",
  balancing_currency: "BRL",
  version: 1,
  postings: [post("cash", 1500), post("divs", -1500)],
  investment_income: {
    account_id: "sec",
    cash_account_id: "cash",
    income_type: "dividend",
    gross: brl(1500),
    withheld: brl(0),
  },
} as unknown as Transaction;
