import { describe, expect, it } from "vitest";

import { shoppingList } from "@/features/portfolio/contribution-plan/shopping-list";
import type { components } from "@/api/schema.gen";

type Plan = components["schemas"]["ContributionPlan"];

const brl = (amount: number) => ({ amount, currency: "BRL" });
const names = (ref: { account_id?: string; instrument?: string }) =>
  ref.instrument ?? ref.account_id ?? "";

// S401 with a fourth class and a class without member targets.
const plan: Plan = {
  status: "complete",
  total: brl(1000000),
  amount: brl(400000),
  classes: [
    { name: "Fixed income", target_bp: 4000, value: brl(0), members: [] },
    {
      name: "Domestic stocks",
      target_bp: 2000,
      value: brl(300000),
      amount: brl(100000),
      members: [
        {
          instrument: "BOVA11",
          target_bp: 5000,
          value: brl(300000),
          amount: brl(0),
        },
        {
          instrument: "PETR4",
          target_bp: 5000,
          value: brl(0),
          unit_value: brl(4000),
          amount: brl(100000),
        },
      ],
    },
  ],
  outside: [],
  missing: [],
};

describe("shoppingList", () => {
  it("lists the member with an amount and its quantity (S401)", () => {
    const got = shoppingList(plan, names);

    expect(got).toEqual([{ name: "PETR4", amount: brl(100000), quantity: 25 }]);
  });

  it("lists a class without member targets by its name, sorted by amount then name", () => {
    const view: Plan = {
      ...plan,
      classes: [
        {
          name: "Real estate funds",
          target_bp: 5000,
          value: brl(0),
          amount: brl(100000),
          members: [{ instrument: "MXRF11", value: brl(0) }],
        },
        {
          name: "Bonds",
          target_bp: 5000,
          value: brl(0),
          amount: brl(100000),
          members: [],
        },
        ...plan.classes.slice(1),
      ],
    };

    const got = shoppingList(view, names);

    expect(got.map((e) => [e.name, e.amount.amount])).toEqual([
      ["Bonds", 100000],
      ["PETR4", 100000],
      ["Real estate funds", 100000],
    ]);
    expect(got[0]?.quantity).toBeUndefined();
  });

  it("returns no entry without a contribution", () => {
    const view: Plan = {
      ...plan,
      classes: [
        { name: "Fixed income", target_bp: 10000, value: brl(0), members: [] },
      ],
    };

    expect(shoppingList(view, names)).toEqual([]);
  });
});
