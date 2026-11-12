import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import { brokerageState } from "@/features/transactions/brokerage-account/use-brokerages";

type Account = components["schemas"]["Account"];

const types = new Map([
  ["BRL", "currency"],
  ["MXRF11", "reit"],
]);

function account(id: string, extra: Partial<Account>): Account {
  return { id, name: id, class: "asset", currency: "BRL", ...extra };
}

const accounts = [
  account("xp", { kind: "brokerage" }),
  account("cash", { kind: "brokerage", parent_id: "xp" }),
  account("old", { parent_id: "xp", closed_on: "2026-01-01" }),
  account("mxrf", { currency: "MXRF11", parent_id: "xp" }),
  account("empty", { kind: "brokerage" }),
  account("bank", { kind: "checking" }),
];

describe("brokerageState", () => {
  it("lists the brokerage roots that have a child", () => {
    const state = brokerageState(accounts, types, "BRL", null, null);

    expect(state.brokerages.map((a) => a.id)).toEqual(["xp"]);
    expect(state.brokerage?.id).toBe("xp");
  });

  it("separates the cash accounts from the holdings and finds the held one", () => {
    const state = brokerageState(accounts, types, "BRL", "xp", "MXRF11");

    expect(state.cash.map((a) => a.id)).toEqual(["cash"]);
    expect(state.cashAccount?.id).toBe("cash");
    expect(state.holdings.map((a) => a.id)).toEqual(["mxrf"]);
    expect(state.held?.id).toBe("mxrf");
    expect(state.baseCash).toBe(true);
  });

  it("reports a brokerage without cash in the base currency", () => {
    const state = brokerageState(accounts, types, "USD", "xp", null);

    expect(state.cash).toEqual([]);
    expect(state.baseCash).toBe(false);
  });
});
