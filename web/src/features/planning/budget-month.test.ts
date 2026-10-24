import { describe, expect, it } from "vitest";

import { categoryEntries } from "@/features/categories";
import type { components } from "@/api/schema.gen";
import { budgetGroups, unbudgeted } from "@/features/planning/budget-month";
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
    expect(groups[0]?.subtotal?.spent).toEqual(money(60000));
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
    );
    expect(rows).toEqual([]);
  });
});
