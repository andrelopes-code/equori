import type { components } from "@/api/schema.gen";

type Goal = components["schemas"]["Goal"];
type GoalExpense = components["schemas"]["GoalExpense"];

export interface PayingGoal {
  goal: Goal;
  // Paid from an account the goal holds whole: no link to change.
  direct: boolean;
}

// The goal that pays a transaction, among the goals with the expenses each one pays; undefined
// when none does (planning coherence A256).
export function payingGoal(
  goals: readonly { goal: Goal; expenses: readonly GoalExpense[] }[],
  transaction: string,
): PayingGoal | undefined {
  for (const { goal, expenses } of goals) {
    const paid = expenses.find((e) => e.transaction_id === transaction);
    if (paid !== undefined) return { goal, direct: paid.direct };
  }

  return undefined;
}
