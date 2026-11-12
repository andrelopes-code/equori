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

const institutional = [
  account("inter", { kind: "brokerage", institution_id: "i1" }),
  account("inter-sec", { currency: "MXRF11", parent_id: "inter" }),
  account("inter-cash", { kind: "brokerage", parent_id: "inter" }),
  account("inter-bank", { kind: "checking", institution_id: "i1" }),
  account("inter-usd", {
    kind: "checking",
    currency: "USD",
    institution_id: "i1",
  }),
  account("inter-old", {
    kind: "checking",
    institution_id: "i1",
    closed_on: "2026-01-01",
  }),
  account("inter-other", { kind: "brokerage", institution_id: "i1" }),
  account("inter-card", { class: "liability", institution_id: "i1" }),
  account("other-bank", { kind: "checking", institution_id: "i2" }),
];

describe("brokerageState", () => {
  it("lists the brokerage roots that have a child", () => {
    const state = brokerageState(accounts, types, "BRL", null, null);

    expect(state.brokerages.map((a) => a.id)).toEqual(["xp"]);
    expect(state.brokerage?.id).toBe("xp");
  });

  it("separates the cash accounts from the holdings and finds the held one", () => {
    const state = brokerageState(accounts, types, "BRL", "xp", "MXRF11");

    expect(state.payers.map((a) => a.id)).toEqual(["cash"]);
    expect(state.payer?.id).toBe("cash");
    expect(state.holdings.map((a) => a.id)).toEqual(["mxrf"]);
    expect(state.held?.id).toBe("mxrf");
    expect(state.baseCash).toBe(true);
  });

  it("reports a brokerage without cash in the base currency", () => {
    const state = brokerageState(accounts, types, "USD", "xp", null);

    expect(state.payers).toEqual([]);
    expect(state.baseCash).toBe(false);
  });

  // BC13, BC14: the Caixa plus the open base-currency asset accounts of the institution.
  it("adds the open accounts of the institution outside the tree to the payers", () => {
    const state = brokerageState(institutional, types, "BRL", "inter", null);

    expect(state.payers.map((a) => a.id)).toEqual(["inter-cash", "inter-bank"]);
    expect(state.payer).toBeUndefined();
  });

  it("takes the account of the institution as the only payer without a Caixa", () => {
    const state = brokerageState(
      institutional.filter((a) => a.id !== "inter-cash"),
      types,
      "BRL",
      "inter",
      null,
    );

    expect(state.payer?.id).toBe("inter-bank");
    expect(state.baseCash).toBe(true);
  });
});
