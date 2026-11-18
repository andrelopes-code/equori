import { describe, expect, it } from "vitest";

import {
  contributionOf,
  shoppingList,
} from "@/features/portfolio/contribution-plan/model/shopping-list";
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
    {
      name: "Fixed income",
      target_bp: 4000,
      questions: [],
      question_ideals: false,
      value: brl(0),
      members: [],
    },
    {
      name: "Domestic stocks",
      target_bp: 2000,
      questions: [],
      question_ideals: false,
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
  it("lists the order of the member: its quantity and its cost (S408, CN17)", () => {
    const view = withPetr4({
      quantity: { amount: 25, currency: "PETR4" },
      cost: brl(100000),
    });

    expect(shoppingList(view, names)).toEqual([
      {
        name: "PETR4",
        code: "PETR4",
        cost: brl(100000),
        quantity: "25",
        unit: brl(4000),
        group: 1,
      },
    ]);
  });

  it("lists the cost, not the planned amount, and the leftover stays out (S409, CN18)", () => {
    const view = withPetr4({
      quantity: { amount: 33, currency: "PETR4" },
      cost: brl(99033),
    });

    expect(shoppingList(view, names)).toEqual([
      {
        name: "PETR4",
        code: "PETR4",
        cost: brl(99033),
        quantity: "33",
        unit: brl(4000),
        group: 1,
      },
    ]);
  });

  it("writes a quantity of a scaled instrument as a decimal string of its scale", () => {
    const view = withPetr4({
      quantity: { amount: 150000, currency: "PETR4" },
      cost: brl(100000),
    });

    const got = shoppingList(view, names, () => 8);

    expect(got[0]?.quantity).toBe("0.00150000");
    expect(got[0]?.symbol).toBe("PETR4");
  });

  it("names no symbol for a quantity in whole units", () => {
    const view = withPetr4({
      quantity: { amount: 25, currency: "PETR4" },
      cost: brl(100000),
    });

    expect(shoppingList(view, names)[0]?.symbol).toBeUndefined();
  });

  it("marks an account member and a class without instruments as bought by value", () => {
    const view: Plan = {
      ...plan,
      classes: [
        {
          name: "Fixed income",
          target_bp: 5000,
          questions: [],
          question_ideals: false,
          value: brl(0),
          amount: brl(100000),
          members: [
            {
              account_id: "acc-1",
              target_bp: 10000,
              value: brl(0),
              amount: brl(60000),
            },
          ],
        },
        {
          name: "Bonds",
          target_bp: 5000,
          questions: [],
          question_ideals: false,
          value: brl(0),
          amount: brl(40000),
          members: [],
        },
      ],
    };

    const got = shoppingList(view, names);

    expect(got.map((e) => [e.name, e.byValue])).toEqual([
      ["acc-1", true],
      ["Bonds", true],
    ]);
  });

  it("names the instrument of a member row and no code for an account member", () => {
    const view: Plan = {
      ...plan,
      classes: [
        {
          name: "Mixed",
          target_bp: 10000,
          questions: [],
          question_ideals: false,
          value: brl(0),
          amount: brl(100000),
          members: [
            {
              instrument: "HGLG11",
              target_bp: 5000,
              value: brl(0),
              amount: brl(50000),
            },
            {
              account_id: "acc-1",
              target_bp: 5000,
              value: brl(0),
              amount: brl(50000),
            },
          ],
        },
      ],
    };

    const got = shoppingList(view, names);

    expect(got.map((e) => [e.name, e.code])).toEqual([
      ["acc-1", undefined],
      ["HGLG11", "HGLG11"],
    ]);
  });

  it("marks an instrument member without a unit value as unpriced", () => {
    const view = withPetr4({});
    delete view.classes[1]?.members[1]?.unit_value;

    const got = shoppingList(view, names);

    expect(got[0]?.unpriced).toBe(true);
    expect(got[0]?.byValue).toBeUndefined();
  });

  it("lists a member without a quantity by its amount", () => {
    const got = shoppingList(withPetr4({}), names);

    expect(got).toEqual([
      { name: "PETR4", code: "PETR4", cost: brl(100000), group: 1 },
    ]);
  });

  it("lists a member with a cost and no planned amount", () => {
    const view = withPetr4({ amount: brl(0), cost: brl(4000) });

    expect(shoppingList(view, names)[0]?.cost).toEqual(brl(4000));
  });

  it("marks a class without member targets that holds an instrument", () => {
    const view: Plan = {
      ...plan,
      classes: [
        {
          name: "Real estate funds",
          target_bp: 5000,
          questions: [],
          question_ideals: false,
          value: brl(0),
          amount: brl(100000),
          cost: brl(100000),
          members: [{ instrument: "MXRF11", value: brl(0) }],
        },
        {
          name: "Bonds",
          target_bp: 5000,
          questions: [],
          question_ideals: false,
          value: brl(0),
          amount: brl(100000),
          members: [],
        },
      ],
    };

    const got = shoppingList(view, names);

    expect(got.map((e) => [e.name, e.splitToSee ?? false])).toEqual([
      ["Bonds", false],
      ["Real estate funds", true],
    ]);
  });

  it("lists a class without member targets by its name, sorted by amount then name", () => {
    const view: Plan = {
      ...plan,
      classes: [
        {
          name: "Real estate funds",
          target_bp: 5000,
          questions: [],
          question_ideals: false,
          value: brl(0),
          amount: brl(100000),
          members: [{ instrument: "MXRF11", value: brl(0) }],
        },
        {
          name: "Bonds",
          target_bp: 5000,
          questions: [],
          question_ideals: false,
          value: brl(0),
          amount: brl(100000),
          members: [],
        },
        ...plan.classes.slice(1),
      ],
    };

    const got = shoppingList(view, names);

    expect(got.map((e) => [e.name, e.cost.amount])).toEqual([
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
        {
          name: "Fixed income",
          target_bp: 10000,
          questions: [],
          question_ideals: false,
          value: brl(0),
          members: [],
        },
      ],
    };

    expect(shoppingList(view, names)).toEqual([]);
  });
});

describe("contributionOf", () => {
  it("adds the leftover to the costs (S409: 990,33 + 1.000,00 + 9,67)", () => {
    const entries = [
      { name: "PETR4", cost: brl(99033), group: 0 },
      { name: "FIIs", cost: brl(100000), group: 1 },
    ];

    expect(contributionOf(entries, brl(967))).toEqual(brl(200000));
  });

  it("is the sum of the costs without a leftover", () => {
    const entries = [{ name: "PETR4", cost: brl(99033), group: 0 }];

    expect(contributionOf(entries, undefined)).toEqual(brl(99033));
  });
});

// The S401 plan with PETR4 carrying the given fields of its order.
function withPetr4(
  fields: Partial<Plan["classes"][number]["members"][number]>,
) {
  const view: Plan = structuredClone(plan);
  const petr4 = view.classes[1]?.members[1];
  if (petr4 !== undefined) Object.assign(petr4, fields);

  return view;
}
