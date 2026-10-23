import type { components } from "@/api/schema.gen";
import { completionWithReturn } from "@/features/goals/goal-plan";

export type Goal = components["schemas"]["Goal"];

export interface GoalLine {
  goal: Goal;
  // The slider's value, in major units.
  major: number;
  // One major unit of the goal's currency, in minor units.
  unit: number;
  scale: number;
  ready: string | null;
  late: boolean;
}

// The month of completion reads late after the due month.
export function goalLine(
  goal: Goal,
  major: number,
  scale: number,
  today: string,
  annualPercent = 0,
): GoalLine {
  const unit = 10 ** scale;
  const ready = completionWithReturn(
    today,
    goal.remaining.amount,
    major * unit,
    annualPercent,
    goal.current.amount,
  );
  return {
    goal,
    major,
    unit,
    scale,
    ready,
    late: ready === null || ready > goal.due_on.slice(0, 7),
  };
}
