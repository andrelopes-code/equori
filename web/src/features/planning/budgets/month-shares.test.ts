import { describe, expect, it } from "vitest";

import {
  budgetStates,
  spendingSlices,
} from "@/features/planning/budgets/month-shares";
import type { BudgetGroup } from "@/features/planning/model/budget-month";

const brl = (amount: number) => ({ amount, currency: "BRL" });

function group(name: string, rows: [number, number][]): BudgetGroup {
  const figures = (spent: number, planned: number) => ({
    spent: brl(spent),
    planned: brl(planned),
    carried: brl(0),
    available: brl(planned - spent),
  });
  return {
    root: { id: name, name },
    rows: rows.map(([spent, planned]) => ({
      progress: figures(spent, planned),
    })),
    subtotal: figures(
      rows.reduce((sum, [s]) => sum + s, 0),
      rows.reduce((sum, [, p]) => sum + p, 0),
    ),
  } as unknown as BudgetGroup;
}

describe("month shares", () => {
  it("counts the budgets by state", () => {
    // 120 of 100 runs over, 95 of 100 comes near (90% or more), 10 of 100 stays within.
    const groups = [
      group("Food", [
        [120, 100],
        [95, 100],
      ]),
      group("Fun", [[10, 100]]),
    ];

    expect(budgetStates(groups)).toEqual({ over: 1, near: 1, within: 1 });
  });

  it("gives one slice per top category, then the unbudgeted one", () => {
    const groups = [
      group("Food", [
        [120, 100],
        [95, 100],
      ]),
    ];
    const loose = [{ total: brl(30) }, { total: brl(12) }] as never[];

    expect(spendingSlices(groups, loose, "No budget")).toEqual([
      { name: "Food", spent: 215 },
      { name: "No budget", spent: 42 },
    ]);
  });
});
