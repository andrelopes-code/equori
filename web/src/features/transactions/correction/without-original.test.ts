import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import {
  balanceWithout,
  positionWithout,
} from "@/features/transactions/correction/without-original";

type Transaction = components["schemas"]["Transaction"];

describe("positionWithout", () => {
  it.each([
    {
      name: "a sale on the form's date gives its units back",
      held: position(100, 100827),
      date: "2026-10-20",
      want: { quantity: 150, cost: 151240 },
    },
    {
      name: "a sale of the whole position gives it back when none is listed",
      held: undefined,
      date: "2026-10-21",
      want: { quantity: 50, cost: 50413 },
    },
    {
      name: "a form date before the stored date leaves the position",
      held: position(150, 151240),
      date: "2026-10-19",
      want: { quantity: 150, cost: 151240, average: "10.0827" },
    },
  ])("$name", ({ held, date, want }) => {
    const got = positionWithout(held, sale, "sec", date);

    expect(got?.quantity).toEqual({
      amount: want.quantity,
      currency: "MXRF11",
    });
    expect(got?.cost_basis).toEqual({ amount: want.cost, currency: "BRL" });
    expect(got?.average_cost).toBe(want.average);
  });

  it("leaves the position of another account", () => {
    const held = position(10, 1000);

    expect(positionWithout(held, sale, "other", "2026-10-20")).toBe(held);
  });

  it("leaves an undefined position without a transaction to remove", () => {
    expect(
      positionWithout(undefined, undefined, "sec", "2026-10-20"),
    ).toBeUndefined();
  });
});

describe("balanceWithout", () => {
  it.each([
    {
      name: "the cash of the sale leaves the balance",
      date: "2026-10-20",
      want: 46210,
    },
    {
      name: "a form date before the sale keeps it",
      date: "2026-10-19",
      want: 100000,
    },
    {
      name: "another account keeps it",
      date: "2026-10-20",
      account: "x",
      want: 100000,
    },
  ])("$name", ({ date, account, want }) => {
    expect(balanceWithout(100000, sale, account ?? "cash", date)).toBe(want);
  });

  it("keeps an unknown balance unknown", () => {
    expect(
      balanceWithout(undefined, sale, "cash", "2026-10-20"),
    ).toBeUndefined();
  });
});

function position(quantity: number, cost: number) {
  return {
    account_id: "sec",
    instrument: "MXRF11",
    quantity: { amount: quantity, currency: "MXRF11" },
    cost_basis: { amount: cost, currency: "BRL" },
    average_cost: "10.0827",
  };
}

const sale = {
  id: "t1",
  date: "2026-10-20",
  balancing_currency: "BRL",
  version: 1,
  postings: [
    {
      id: "p1",
      account_id: "cash",
      amount: { amount: 53790, currency: "BRL" },
      weight: { amount: 53790, currency: "BRL" },
      status: "cleared",
    },
    {
      id: "p2",
      account_id: "sec",
      amount: { amount: -50, currency: "MXRF11" },
      weight: { amount: -50413, currency: "BRL" },
      status: "cleared",
    },
  ],
} as unknown as Transaction;
