import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import { transactionTitle } from "@/features/transactions/model/transaction-title";
import { catalogEn } from "@/i18n/catalog.en";
import { catalogPtBR } from "@/i18n/catalog.pt-BR";
import type { TFunction } from "@/i18n/i18n-provider";

type Account = components["schemas"]["Account"];
type Transaction = components["schemas"]["Transaction"];

const t = translator(catalogPtBR);
const tEn = translator(catalogEn);

const holdingID = "holding";
const checkingID = "checking";
const savingsID = "savings";
const cardID = "card";
const usdID = "usd";
const openingID = "opening";
const adjustmentsID = "adjustments";
const brokerAID = "broker-a";
const brokerBID = "broker-b";
const custodyAID = "custody-a";
const custodyBID = "custody-b";
const custodyA2ID = "custody-a2";
const cashAID = "cash-a";
const cashBID = "cash-b";
const foodID = "food";
const uncategorizedID = "uncategorized";

const accounts = new Map<string, Account>(
  [
    account(holdingID, "Corretora", { currency: "AUVP11" }),
    account(checkingID, "Nubank"),
    account(brokerAID, "Corretora A", { kind: "brokerage" }),
    account(brokerBID, "Corretora B", { kind: "brokerage" }),
    account(custodyAID, "A PETR4", { currency: "PETR4", parent_id: brokerAID }),
    account(custodyBID, "B PETR4", { currency: "PETR4", parent_id: brokerBID }),
    account(custodyA2ID, "A PETR4 2", {
      currency: "PETR4",
      parent_id: brokerAID,
    }),
    account(cashAID, "A cash", { parent_id: brokerAID }),
    account(cashBID, "B cash", { parent_id: brokerBID }),
    account(savingsID, "Reserva"),
    account(cardID, "Itaú Visa", { class: "liability", kind: "credit_card" }),
    account(usdID, "Wise USD", { currency: "USD" }),
    account(openingID, "Saldo inicial", {
      class: "equity",
      system_role: "opening_balances",
    }),
    account(adjustmentsID, "Ajustes", {
      class: "equity",
      system_role: "adjustments",
    }),
    account(foodID, "Mercado", { class: "expense" }),
    account(uncategorizedID, "Sem categoria", {
      class: "expense",
      system_role: "uncategorized_expense",
    }),
  ].map((a) => [a.id, a]),
);

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

function trade(side: "buy" | "sell" | "opening"): Transaction {
  const money = { amount: 10, currency: "BRL" };
  return tx({
    trade: {
      account_id: holdingID,
      cash_account_id: "cash",
      side,
      settlement_date: "2026-10-17",
      quantity: { amount: 10, currency: "AUVP11" },
      unit_price: "10",
      gross: money,
      fees: money,
      taxes: money,
      day_trade_quantity: { amount: 0, currency: "AUVP11" },
      day_trade_cost: { amount: 0, currency: "BRL" },
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

function moved(from: string, to: string, currency: string): Transaction {
  const posting = (account_id: string, amount: number) => ({
    id: `p-${account_id}`,
    account_id,
    amount: { amount, currency },
    weight: { amount, currency: "BRL" },
  });

  return tx({ postings: [posting(from, -40), posting(to, 40)] });
}

function action(kind: "split" | "reverse_split" | "bonus"): Transaction {
  const units = (amount: number) => ({ amount, currency: "AUVP11" });
  return tx({
    corporate_action: {
      account_id: holdingID,
      kind,
      ratio_from: 1,
      ratio_to: 10,
      held: units(10),
      received: units(100),
      fraction: "0",
      value: { amount: 0, currency: "BRL" },
    },
  });
}

function translator(catalog: Record<string, string>): TFunction {
  return (key, vars) =>
    Object.entries(vars ?? {}).reduce(
      (text, [name, value]) => text.replace(`{${name}}`, String(value)),
      catalog[key] ?? "",
    );
}

function account(
  id: string,
  name: string,
  overrides: Partial<Account> = {},
): Account {
  return {
    id,
    name,
    class: "asset",
    kind: "checking",
    currency: "BRL",
    ...overrides,
  };
}

function posted(
  entries: [string, number, string?][],
  overrides: Partial<Transaction> = {},
): Transaction {
  return tx({
    postings: entries.map(([account_id, amount, currency], i) => ({
      id: `p${String(i)}`,
      account_id,
      amount: { amount, currency: currency ?? "BRL" },
      status: "cleared",
    })),
    ...overrides,
  });
}

describe("transactionTitle", () => {
  it("titles a purchase with an empty description", () => {
    expect(transactionTitle(trade("buy"), t)).toBe("Compra de AUVP11");
    expect(transactionTitle(trade("opening"), t)).toBe("Abertura de AUVP11");
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

  it("titles an action with its event and the currency of the holding account", () => {
    expect(transactionTitle(action("reverse_split"), t, { accounts })).toBe(
      "Grupamento de AUVP11",
    );
    expect(transactionTitle(action("bonus"), tEn, { accounts })).toBe(
      "Bonus of AUVP11",
    );
  });

  it("returns empty for an action whose holding account is unknown", () => {
    expect(transactionTitle(action("split"), t)).toBe("");
  });

  // A228 IO31: the ledger writes the description of a custody transfer in the book's language.
  it("titles a custody transfer by the description the ledger writes", () => {
    const custody = {
      ...moved(custodyAID, custodyBID, "PETR4"),
      description: "Transferência de custódia de PETR4",
    };

    expect(transactionTitle(custody, t, { accounts })).toBe(
      "Transferência de custódia de PETR4",
    );
  });

  it("does not title as a custody a movement inside one brokerage", () => {
    const inside = moved(custodyAID, custodyA2ID, "PETR4");

    expect(transactionTitle(inside, tEn, { accounts })).not.toBe(
      "Custody of PETR4",
    );
  });

  it("does not title as a custody a transfer of cash between two brokerages", () => {
    const cash = moved(cashAID, cashBID, "BRL");

    expect(transactionTitle(cash, tEn, { accounts })).not.toBe(
      "Custody of BRL",
    );
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

  it("titles a transfer from the account that loses money to the one that gains it", () => {
    const transfer = posted([
      [checkingID, -5000],
      [savingsID, 5000],
    ]);

    expect(transactionTitle(transfer, t, { accounts })).toBe(
      "Transferência de Nubank para Reserva",
    );
    expect(transactionTitle(transfer, tEn, { accounts })).toBe(
      "Transfer from Nubank to Reserva",
    );
  });

  it("keeps the description of a transfer", () => {
    const transfer = posted(
      [
        [checkingID, -5000],
        [savingsID, 5000],
      ],
      { description: "Reserva de outubro" },
    );

    expect(transactionTitle(transfer, t, { accounts })).toBe(
      "Reserva de outubro",
    );
  });

  it("keeps the payee of a transfer", () => {
    const transfer = posted([
      [checkingID, -5000],
      [savingsID, 5000],
    ]);

    expect(transactionTitle(transfer, t, { accounts, payee: "Ana" })).toBe(
      "Ana",
    );
  });

  it("titles a transfer into a credit card as the payment of its statement", () => {
    const payment = posted([
      [checkingID, -5000],
      [cardID, 5000],
    ]);

    expect(transactionTitle(payment, t, { accounts })).toBe(
      "Pagamento da fatura Itaú Visa",
    );
    expect(transactionTitle(payment, tEn, { accounts })).toBe(
      "Payment of the Itaú Visa statement",
    );
  });

  it("titles the exchange of two currencies with their codes", () => {
    const exchange = posted([
      [checkingID, -5000],
      [usdID, 1000, "USD"],
    ]);

    expect(transactionTitle(exchange, t, { accounts })).toBe(
      "Câmbio de BRL para USD",
    );
    expect(transactionTitle(exchange, tEn, { accounts })).toBe(
      "Exchange of BRL for USD",
    );
  });

  it("titles an opening balance with the opened account", () => {
    const opening = posted([
      [checkingID, 5000],
      [openingID, -5000],
    ]);

    expect(transactionTitle(opening, t, { accounts })).toBe(
      "Saldo inicial de Nubank",
    );
    expect(transactionTitle(opening, tEn, { accounts })).toBe(
      "Opening balance of Nubank",
    );
  });

  it("titles a balance adjustment with the adjusted account", () => {
    const adjustment = posted([
      [savingsID, -300],
      [adjustmentsID, 300],
    ]);

    expect(transactionTitle(adjustment, t, { accounts })).toBe(
      "Ajuste de saldo de Reserva",
    );
    expect(transactionTitle(adjustment, tEn, { accounts })).toBe(
      "Balance adjustment of Reserva",
    );
  });

  it("titles an expense or an income with the name of its category", () => {
    const expense = posted([
      [checkingID, -5000],
      [foodID, 5000],
    ]);
    const income = posted([
      [checkingID, 5000],
      [foodID, -5000],
    ]);

    expect(transactionTitle(expense, t, { accounts })).toBe("Mercado");
    expect(transactionTitle(income, t, { accounts })).toBe("Mercado");
  });

  it("returns empty for an expense in an uncategorized system account", () => {
    const expense = posted([
      [checkingID, -5000],
      [uncategorizedID, 5000],
    ]);

    expect(transactionTitle(expense, t, { accounts })).toBe("");
  });

  it("returns empty for a transfer when the accounts are unknown", () => {
    const transfer = posted([
      [checkingID, -5000],
      [savingsID, 5000],
    ]);

    expect(transactionTitle(transfer, t)).toBe("");
  });
});
