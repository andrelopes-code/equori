import { describe, expect, it } from "vitest";

import { emptyAction } from "@/features/transactions/action-entry/action-draft";
import { actionOrder } from "@/features/transactions/action-entry/action-order";

const target = {
  brokerageID: "b1",
  instrument: "FUND1",
  heldID: "h1",
  base: "BRL",
};

describe("actionOrder", () => {
  it("sends a unit tax on its holding with the ratio 1:1", () => {
    const draft = {
      ...emptyAction("2026-11-30", "b1"),
      kind: "unit_tax" as const,
      quantity: 12500000,
      amount: 15000,
      description: " come-cotas ",
    };

    const order = actionOrder(draft, target);

    expect(order).toEqual({
      account_id: "h1",
      kind: "unit_tax",
      date: "2026-11-30",
      ratio_from: 1,
      ratio_to: 1,
      quantity: { amount: 12500000, currency: "FUND1" },
      amount: { amount: 15000, currency: "BRL" },
      description: "come-cotas",
    });
  });

  // Coverage row E-08: a capital return sends the cash returned, ratio 1:1.
  it("sends a capital return with its amount", () => {
    const draft = {
      ...emptyAction("2026-11-10", "b1"),
      kind: "capital_return" as const,
      amount: 20000,
    };

    expect(actionOrder(draft, target)).toEqual({
      brokerage_id: "b1",
      instrument: "FUND1",
      kind: "capital_return",
      date: "2026-11-10",
      ratio_from: 1,
      ratio_to: 1,
      amount: { amount: 20000, currency: "BRL" },
    });
  });

  it("sends a split on the brokerage and the investment", () => {
    const draft = {
      ...emptyAction("2026-11-30", "b1"),
      kind: "split" as const,
      ratioFrom: 1,
      ratioTo: 4,
    };

    const order = actionOrder(draft, target);

    expect(order).toEqual({
      brokerage_id: "b1",
      instrument: "FUND1",
      kind: "split",
      date: "2026-11-30",
      ratio_from: 1,
      ratio_to: 4,
    });
  });

  it("sends the unit cost and the category of a bonus only", () => {
    const draft = {
      ...emptyAction("2026-11-30", "b1"),
      kind: "bonus" as const,
      ratioFrom: 10,
      ratioTo: 1,
      unitCost: "12.5",
      categoryId: "c1",
    };

    const order = actionOrder(draft, target);

    expect(order.category_id).toBe("c1");
    expect(order.unit_cost).not.toBeUndefined();
    expect(actionOrder({ ...draft, kind: "split" }, target)).not.toHaveProperty(
      "unit_cost",
    );
  });
});
