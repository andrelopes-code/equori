import { describe, expect, it } from "vitest";

import {
  emptyTrade,
  storedTrade,
} from "@/features/transactions/trade-entry/trade-draft";

describe("storedTrade", () => {
  it("keeps the price of a stored draft as a decimal", () => {
    const stored = { ...emptyTrade("2026-10-17"), unitPrice: "9,50" };

    expect(storedTrade(stored, "2026-11-15").unitPrice).toBe("9.50");
  });

  it("drops a stored price that is no price", () => {
    const stored = { ...emptyTrade("2026-10-17"), unitPrice: "abc" };

    expect(storedTrade(stored, "2026-11-15").unitPrice).toBeNull();
  });

  it("gives the fields added since the draft was stored their empty value", () => {
    const old = {
      side: "buy" as const,
      brokerageId: null,
      instrument: null,
      cashAccountId: null,
      date: "2026-10-17",
      quantity: 3,
      unitPrice: "9.50",
      fees: 0,
      taxes: 0,
      taxesCategoryId: null,
      description: "",
    };

    // A draft of the old shape lacks priceBasis and total.
    expect(storedTrade(old as never, "2026-11-15")).toMatchObject({
      priceBasis: "unit",
      total: 0,
      date: "2026-10-17",
    });
  });
});
