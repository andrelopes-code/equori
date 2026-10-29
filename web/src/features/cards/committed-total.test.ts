import { describe, expect, it } from "vitest";

import { committedTotal } from "@/features/cards/committed-total";

describe("committedTotal", () => {
  it("adds the months that hold an amount, in the card's currency", () => {
    const months = [
      { amount: { amount: 12000, currency: "BRL" } },
      { amount: undefined },
      { amount: { amount: 3050, currency: "BRL" } },
    ];

    expect(committedTotal(months, "BRL")).toEqual({
      amount: 15050,
      currency: "BRL",
    });
  });

  it("is zero without months", () => {
    expect(committedTotal([], "EUR")).toEqual({ amount: 0, currency: "EUR" });
  });
});
