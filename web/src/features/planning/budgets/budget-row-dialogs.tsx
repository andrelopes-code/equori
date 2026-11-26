import { BudgetAmountDialog } from "@/features/planning/budget-dialogs/budget-amount-dialog";
import { DeleteBudgetDialog } from "@/features/planning/budget-dialogs/delete-budget-dialog";
import { EndBudgetDialog } from "@/features/planning/budget-dialogs/end-budget-dialog";
import type { BudgetDialog } from "@/features/planning/budgets/use-budget-dialogs";

interface BudgetRowDialogsProps {
  dialog: BudgetDialog | null;
  month: string;
  onClose: () => void;
}

// The dialog a budget line opened: change its amount, end it from the month, delete it.
export function BudgetRowDialogs({
  dialog,
  month,
  onClose,
}: BudgetRowDialogsProps) {
  if (dialog === null) return null;

  return (
    <>
      {dialog.kind === "amount" && (
        <BudgetAmountDialog
          budget={dialog.budget}
          onDone={onClose}
          onCancel={onClose}
        />
      )}
      {dialog.kind === "end" && (
        <EndBudgetDialog
          budget={dialog.row.budget}
          name={dialog.row.label}
          month={month}
          carried={dialog.row.progress.carried}
          onDone={onClose}
          onCancel={onClose}
        />
      )}
      {dialog.kind === "delete" && (
        <DeleteBudgetDialog
          budget={dialog.budget}
          name={dialog.name}
          onDone={onClose}
          onCancel={onClose}
        />
      )}
    </>
  );
}
