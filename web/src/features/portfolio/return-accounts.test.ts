import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import { returnAccounts } from "@/features/portfolio/return-accounts";

type Account = components["schemas"]["Account"];

function account(id: string, over: Partial<Account> = {}): Account {
  return {
    id,
    name: id,
    class: "asset",
    currency: "BRL",
    opened_on: "2026-01-01",
    yield_mode: "none",
    ...over,
  };
}

describe("returnAccounts", () => {
  it("lists the brokerages, their investments, then savings and reserves (A208 R7)", () => {
    const accounts = [
      account("Reserve", { kind: "reserve" }),
      account("Checking", { kind: "checking" }),
      account("Broker", { kind: "brokerage" }),
      account("MXRF11", {
        kind: "brokerage",
        parent_id: "Broker",
        currency: "MXRF11",
      }),
      account("Savings", { kind: "savings" }),
      account("Card", { class: "liability", kind: "credit_card" }),
    ];

    const ids = returnAccounts(
      accounts,
      new Set(["BRL"]),
      (a) => a.name,
      "en",
    ).map((a) => a.id);

    expect(ids).toEqual(["Broker", "MXRF11", "Reserve", "Savings"]);
  });
});
