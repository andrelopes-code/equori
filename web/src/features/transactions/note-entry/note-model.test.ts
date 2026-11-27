import { describe, expect, it } from "vitest";

import {
  emptyNote,
  emptyOrder,
} from "@/features/transactions/note-entry/note-draft";
import {
  noteBody,
  noteProblems,
  orderGrosses,
} from "@/features/transactions/note-entry/note-model";

const scale = (code: string) => (code === "BRL" ? 2 : 0);
const buy = {
  ...emptyOrder(),
  instrument: "MXRF11",
  quantity: 100,
  unitPrice: "30.05",
};
const sell = { ...buy, side: "sell" as const, unitPrice: "30" };
const ids = { brokerage: "b1", payer: "c1" };
const cash = { currency: "BRL", exchangeRate: null };

describe("orderGrosses", () => {
  it("prices a complete order and leaves an incomplete one null", () => {
    expect(orderGrosses([buy, emptyOrder()], scale, 2)).toEqual([300500, null]);
  });
});

describe("noteProblems", () => {
  it("names each missing part by the key the server uses", () => {
    const draft = { ...emptyNote("2026-10-17"), orders: [emptyOrder(), buy] };

    expect(noteProblems(draft, { brokerage: false, payer: false })).toEqual({
      brokerage_id: "entry.required.account",
      cash_account_id: "trade.required.cashAccount",
      "orders[0].instrument": "trade.required.securityAccount",
      "orders[0].quantity": "trade.required.quantity",
      "orders[0].unit_price": "trade.required.price",
    });
  });

  it("requires at least one order", () => {
    const draft = { ...emptyNote("2026-10-17"), orders: [] };

    expect(noteProblems(draft, { brokerage: true, payer: true })).toEqual({
      orders: "note.required.orders",
    });
  });
});

describe("noteBody", () => {
  it("sends the orders in order and the fees only when positive", () => {
    const draft = {
      ...emptyNote("2026-10-17"),
      fees: 251,
      taxes: 40,
      orders: [buy, sell],
    };

    expect(noteBody(draft, ids, cash)).toEqual({
      brokerage_id: "b1",
      cash_account_id: "c1",
      date: "2026-10-17",
      fees: { amount: 251, currency: "BRL" },
      taxes: { amount: 40, currency: "BRL" },
      orders: [
        {
          side: "buy",
          instrument: "MXRF11",
          quantity: { amount: 100, currency: "MXRF11" },
          unit_price: "30.05",
        },
        {
          side: "sell",
          instrument: "MXRF11",
          quantity: { amount: 100, currency: "MXRF11" },
          unit_price: "30",
        },
      ],
    });
  });

  it("drops the taxes of a note with no sale", () => {
    const draft = { ...emptyNote("2026-10-17"), taxes: 40, orders: [buy] };

    expect(noteBody(draft, ids, cash)).not.toHaveProperty("taxes");
  });
});
