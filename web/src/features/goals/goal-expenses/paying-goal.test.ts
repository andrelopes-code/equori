import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import { payingGoal } from "@/features/goals/goal-expenses/paying-goal";

type Goal = components["schemas"]["Goal"];
type GoalExpense = components["schemas"]["GoalExpense"];

const goal = (id: string) => ({ id, name: id }) as Goal;
const expense = (transaction_id: string, direct: boolean) =>
  ({ transaction_id, direct }) as GoalExpense;

describe("payingGoal", () => {
  const goals = [
    { goal: goal("trip"), expenses: [expense("flight", false)] },
    { goal: goal("car"), expenses: [expense("tyres", true)] },
  ];

  it("returns the goal whose expenses hold the transaction", () => {
    expect(payingGoal(goals, "flight")).toEqual({
      goal: goal("trip"),
      direct: false,
    });
    expect(payingGoal(goals, "tyres")?.direct).toBe(true);
  });

  it("returns undefined for a transaction no goal pays", () => {
    expect(payingGoal(goals, "rent")).toBeUndefined();
  });
});
