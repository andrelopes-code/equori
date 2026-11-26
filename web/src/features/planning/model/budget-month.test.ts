import { describe, expect, it } from "vitest";

import { categoryEntries } from "@/features/categories";
import type { components } from "@/api/schema.gen";
import {
  budgetGroups,
  inForce,
  unbudgeted,
} from "@/features/planning/model/budget-month";
import { money } from "@/testing/account-api";
import {
  categories,
  food,
  foodBudget,
  restaurant,
  supermarket,
} from "@/testing/budget-api";

type Account = components["schemas"]["Account"];

const entries = categoryEntries(categories as Account[], "en");

function progress(spent: number) {
  return {
    month: "2026-11",
    planned: money(100000),
    carried: money(0),
    spent: money(spent),
    goal_paid: money(0),
    available: money(100000 - spent),
  };
}

describe("budgetGroups", () => {
  it("adds only the budgets with no budgeted ancestor to the subtotal", () => {
    const child = {
      ...foodBudget,
      id: "child",
      category_id: supermarket.id,
      rollover: false,
    };
    const groups = budgetGroups(
      entries,
      [foodBudget, child],
      new Map([
        [foodBudget.id, progress(60000)],
        [child.id, progress(40000)],
      ]),
    );
    expect(groups.map((g) => g.rows.map((r) => r.label))).toEqual([
      ["Food", "Supermarket"],
    ]);
    expect(groups[0]?.subtotal.spent).toEqual(money(60000));
  });
});

describe("unbudgeted", () => {
  it("leaves out a category under a budgeted one and a category with nothing booked", () => {
    const rows = unbudgeted(
      entries,
      [{ ...foodBudget, category_id: food.id }],
      [
        {
          account_id: restaurant.id,
          total: money(5000),
          subtree_total: money(5000),
        },
        { account_id: food.id, total: money(0), subtree_total: money(5000) },
      ],
      "2026-11",
    );
    expect(rows).toEqual([]);
  });

  // Budget end E15: spending is covered only by a budget in force in the month.
  it("lists the spending of a category whose budget ended or has not started", () => {
    const spending = [
      {
        account_id: restaurant.id,
        total: money(5000),
        subtree_total: money(5000),
      },
    ];
    const ended = {
      ...foodBudget,
      category_id: food.id,
      amounts: [
        { effective_from: "2026-10", amount: money(180000), ended: false },
        { effective_from: "2026-12", amount: money(0), ended: true },
      ],
    };
    const later = {
      ...foodBudget,
      category_id: food.id,
      amounts: [
        { effective_from: "2027-01", amount: money(180000), ended: false },
      ],
    };

    const afterEnd = unbudgeted(entries, [ended], spending, "2026-12");
    const beforeEnd = unbudgeted(entries, [ended], spending, "2026-11");
    const beforeStart = unbudgeted(entries, [later], spending, "2026-12");

    expect(afterEnd.map((r) => r.entry.id)).toEqual([restaurant.id]);
    expect(beforeEnd).toEqual([]);
    expect(beforeStart.map((r) => r.entry.id)).toEqual([restaurant.id]);
  });
});

// Budget end E14: the mirror of Budget.InForce.
describe("inForce", () => {
  const budget = {
    ...foodBudget,
    amounts: [
      { effective_from: "2026-11", amount: money(42800), ended: false },
      { effective_from: "2026-12", amount: money(0), ended: true },
      { effective_from: "2027-02", amount: money(30000), ended: false },
    ],
  };

  it.each([
    ["2026-10", false],
    ["2026-11", true],
    ["2026-12", false],
    ["2027-01", false],
    ["2027-02", true],
    ["2027-03", true],
  ])("in %s is %s", (month, want) => {
    expect(inForce(budget, month)).toBe(want);
  });
});
