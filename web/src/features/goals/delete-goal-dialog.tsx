import { useState } from "react";

import { errorText } from "@/api/problem";
import type { Goal } from "@/features/goals/goal-line";
import { useDeleteGoal } from "@/features/planning";
import { useT } from "@/i18n/i18n-provider";
import { ConfirmDialog } from "@/ui/confirm-dialog";

// Deleting a goal removes only the goal; the dialog says so before the reader confirms.
export function DeleteGoalDialog({
  goal,
  onDone,
  onCancel,
}: {
  goal: Goal;
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const remove = useDeleteGoal();
  const [error, setError] = useState<string | null>(null);

  function handleConfirm() {
    setError(null);
    remove
      .mutateAsync(goal.id)
      .then(onDone)
      .catch((caught: unknown) => {
        setError(errorText(caught, t));
      });
  }

  return (
    <ConfirmDialog
      title={t("goals.deleteTitle", { name: goal.name })}
      description={t("goals.deleteHint")}
      confirmLabel={t("goals.delete")}
      pending={remove.isPending}
      error={error}
      onConfirm={handleConfirm}
      onCancel={onCancel}
    />
  );
}
