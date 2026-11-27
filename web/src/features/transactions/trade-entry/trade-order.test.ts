import { describe, expect, it } from "vitest";

import { emptyTrade } from "@/features/transactions/trade-entry/trade-draft";
import { tradeOrder } from "@/features/transactions/trade-entry/trade-order";

const parts = {
  brokerageId: "b1",
  instrument: "PETRK300",
  cashAccountId: "c1",
  rate: "0.50",
  currency: "BRL",
  exchangeRate: null,
  taxes: 0,
};

describe("tradeOrder", () => {
  it("sends a purchase with its cash account, price and fees", () => {
    const draft = { ...emptyTrade("2026-11-03"), quantity: 100, fees: 490 };

    expect(tradeOrder(draft, parts)).toEqual({
      brokerage_id: "b1",
      instrument: "PETRK300",
      side: "buy",
      date: "2026-11-03",
      quantity: { amount: 100, currency: "PETRK300" },
      cash_account_id: "c1",
      unit_price: "0.50",
      fees: { amount: 490, currency: "BRL" },
    });
  });

  // Listed options design W1, O8: a write-off sends the holding, the date and the quantity.
  it("sends a write-off without cash, price or charges", () => {
    const draft = {
      ...emptyTrade("2026-11-16"),
      side: "write_off" as const,
      quantity: 100,
      fees: 490,
      settlementDate: "2026-11-18",
    };

    expect(tradeOrder(draft, parts)).toEqual({
      brokerage_id: "b1",
      instrument: "PETRK300",
      side: "write_off",
      date: "2026-11-16",
      quantity: { amount: 100, currency: "PETRK300" },
    });
  });

  // Investment history OL1: an opening sends no cash account, settlement or taxes.
  it("sends an opening without cash, settlement or taxes", () => {
    const draft = {
      ...emptyTrade("2021-03-10"),
      side: "opening" as const,
      quantity: 100,
      fees: 500,
      taxes: 60,
      settlementDate: "2021-03-12",
    };

    expect(tradeOrder(draft, { ...parts, rate: "20.00", taxes: 60 })).toEqual({
      brokerage_id: "b1",
      instrument: "PETRK300",
      side: "opening",
      date: "2021-03-10",
      quantity: { amount: 100, currency: "PETRK300" },
      unit_price: "20.00",
      fees: { amount: 500, currency: "BRL" },
    });
  });

  // FC19: cash in the quote currency sends the rate and the charges in that currency.
  it("sends the exchange rate and the fees in the cash currency", () => {
    const draft = { ...emptyTrade("2026-11-03"), quantity: 10, fees: 100 };

    expect(
      tradeOrder(draft, {
        ...parts,
        rate: "500.00",
        currency: "USD",
        exchangeRate: "5.20",
      }),
    ).toEqual({
      brokerage_id: "b1",
      instrument: "PETRK300",
      side: "buy",
      date: "2026-11-03",
      quantity: { amount: 10, currency: "PETRK300" },
      cash_account_id: "c1",
      unit_price: "500.00",
      exchange_rate: "5.20",
      fees: { amount: 100, currency: "USD" },
    });
  });
});
