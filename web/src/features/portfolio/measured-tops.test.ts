import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import { measuredTops } from "@/features/portfolio/measured-tops";

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

describe("measuredTops", () => {
  it("keeps the top of each measured tree and leaves out checking accounts", () => {
    const accounts = [
      account("Checking", { kind: "checking" }),
      account("Box", { kind: "savings", parent_id: "Checking" }),
      account("Reserve", { kind: "reserve" }),
      account("Broker", { kind: "brokerage" }),
      account("PETR4", {
        kind: "brokerage",
        parent_id: "Broker",
        currency: "PETR4",
      }),
      account("Card", { class: "liability", kind: "credit_card" }),
    ];

    expect([...measuredTops(accounts, new Set(["BRL"]))].sort()).toEqual([
      "Box",
      "Broker",
      "Reserve",
    ]);
  });
});
