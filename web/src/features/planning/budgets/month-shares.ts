import type { components } from "@/api/schema.gen";
import type { CategoryEntry } from "@/features/categories";
import type { SpendingSlice } from "@/features/planning/budgets/budget-spending-chart";
import { budgetState } from "@/features/planning/model/budget-month";
import type {
  BudgetGroup,
  BudgetState,
} from "@/features/planning/model/budget-month";

type Money = components["schemas"]["Money"];

// How many budgets of the month ran over, came near, or stayed within their room.
export function budgetStates(
  groups: readonly BudgetGroup[],
): Record<BudgetState, number> {
  const states: Record<BudgetState, number> = { over: 0, near: 0, within: 0 };
  for (const g of groups)
    for (const r of g.rows) states[budgetState(r.progress)] += 1;

  return states;
}

// One slice per top category with budgets, then one named unbudgeted for what no budget covers.
export function spendingSlices(
  groups: readonly BudgetGroup[],
  loose: readonly { entry: CategoryEntry; total: Money }[],
  unbudgeted: string,
): SpendingSlice[] {
  return [
    ...groups.map((g) => ({
      name: g.root.name,
      spent: g.subtotal.spent.amount,
    })),
    {
      name: unbudgeted,
      spent: loose.reduce((sum, r) => sum + r.total.amount, 0),
    },
  ];
}
