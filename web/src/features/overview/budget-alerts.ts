import { budgetState, usedShare } from "@/features/planning";
import type { BudgetState, Figures } from "@/features/planning";

export interface BudgetAlert {
  id: string;
  name: string;
  state: Exclude<BudgetState, "within">;
  // Percent of planned plus carried already spent.
  share: number;
}

export function budgetAlerts(
  rows: readonly { id: string; name: string; progress: Figures }[],
): BudgetAlert[] {
  return rows
    .flatMap((row) => {
      const state = budgetState(row.progress);
      return state === "within"
        ? []
        : [
            {
              id: row.id,
              name: row.name,
              state,
              share: usedShare(row.progress),
            },
          ];
    })
    .sort(
      (a, b) =>
        Number(b.state === "over") - Number(a.state === "over") ||
        b.share - a.share ||
        a.id.localeCompare(b.id),
    );
}
