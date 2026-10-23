import type { Goal } from "@/features/goals/goal-line";
import { monthsBetween } from "@/features/goals/goal-plan";

export type GoalState = "reached" | "overdue" | "open";

export function goalState(goal: Goal, today: string): GoalState {
  if (goal.remaining.amount === 0) return "reached";
  return goal.due_on < today ? "overdue" : "open";
}

// Whole months from today's month to the due month; negative once the due month passed.
export function monthsLeft(today: string, due: string): number {
  return monthsBetween(today.slice(0, 7), due.slice(0, 7));
}
