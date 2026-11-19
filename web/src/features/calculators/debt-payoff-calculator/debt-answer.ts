import { payoffPlan } from "@/features/calculators/debt-payoff-calculator/debt-math";
import type {
  Debt,
  PayoffOrder,
  PayoffPlan,
} from "@/features/calculators/debt-payoff-calculator/debt-math";

export type DebtAnswer =
  | { kind: "missing" }
  // The budget is below the sum of the minimums: no order pays every debt.
  | { kind: "below_minimums" }
  // An order leaves a debt open after the last month the plan runs; null is that order.
  | { kind: "open"; avalanche: PayoffPlan | null; snowball: PayoffPlan | null }
  | {
      kind: "solved";
      cheaper: PayoffOrder | "equal";
      // Minor units: the interest of the other order less the interest of the cheaper one.
      saving: number;
      avalanche: PayoffPlan;
      snowball: PayoffPlan;
    };

// Design §5, debt-payoff: the avalanche and the snowball over the same debts and budget. The
// debts are null while any row is incomplete.
export function debtAnswer(
  debts: readonly Debt[] | null,
  budget: number | null,
): DebtAnswer {
  if (budget === null || debts === null || debts.length === 0)
    return { kind: "missing" };

  const avalanche = payoffPlan(debts, budget, "avalanche");
  const snowball = payoffPlan(debts, budget, "snowball");
  if (avalanche === "below_minimums" || snowball === "below_minimums")
    return { kind: "below_minimums" };
  if (avalanche === "not_closed" || snowball === "not_closed")
    return {
      kind: "open",
      avalanche: avalanche === "not_closed" ? null : avalanche,
      snowball: snowball === "not_closed" ? null : snowball,
    };

  const difference = snowball.interest - avalanche.interest;

  return {
    kind: "solved",
    cheaper: cheaperOrder(difference),
    saving: Math.abs(difference),
    avalanche,
    snowball,
  };
}

function cheaperOrder(snowballLess: number): PayoffOrder | "equal" {
  if (snowballLess > 0) return "avalanche";
  if (snowballLess < 0) return "snowball";

  return "equal";
}
