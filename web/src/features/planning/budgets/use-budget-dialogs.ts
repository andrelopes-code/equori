import { useState } from "react";

import type { components } from "@/api/schema.gen";
import type { BudgetRow } from "@/features/planning/model/budget-month";

type Budget = components["schemas"]["Budget"];

// The one dialog a budget line opens at a time.
export type BudgetDialog =
  | { kind: "amount"; budget: Budget }
  | { kind: "end"; row: BudgetRow }
  | { kind: "delete"; budget: Budget; name: string };

// The dialogs of the budget lines of Track: which one is open and how each opens.
export function useBudgetDialogs() {
  const [dialog, setDialog] = useState<BudgetDialog | null>(null);

  return {
    dialog,
    close: () => {
      setDialog(null);
    },
    changeAmount: (budget: Budget) => {
      setDialog({ kind: "amount", budget });
    },
    end: (row: BudgetRow) => {
      setDialog({ kind: "end", row });
    },
    remove: (budget: Budget, name: string) => {
      setDialog({ kind: "delete", budget, name });
    },
  };
}
