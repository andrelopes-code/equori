import { useState } from "react";

import { errorText } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { useDeleteBudget } from "@/features/planning/api";
import { useT } from "@/i18n/i18n-provider";
import { ConfirmDialog } from "@/ui/confirm-dialog";

// Deleting a budget removes it with its amounts and leaves the category and its transactions;
// the dialog says so before the reader confirms (S144).
export function DeleteBudgetDialog({
  budget,
  name,
  onDone,
  onCancel,
}: {
  budget: components["schemas"]["Budget"];
  // The category the budget is for, as the month view names it.
  name: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const remove = useDeleteBudget();
  const [error, setError] = useState<string | null>(null);

  function handleConfirm() {
    setError(null);
    remove
      .mutateAsync(budget.id)
      .then(onDone)
      .catch((caught: unknown) => {
        setError(errorText(caught, t));
      });
  }

  return (
    <ConfirmDialog
      title={t("budget.deleteTitle", { name })}
      description={t("budget.deleteHint")}
      confirmLabel={t("budget.delete")}
      pending={remove.isPending}
      error={error}
      onConfirm={handleConfirm}
      onCancel={onCancel}
    />
  );
}
