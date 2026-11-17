import { useState } from "react";

import { errorText } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import {
  useConfirmInvestmentMovement,
  useDismissInvestmentMovement,
  useUndoInvestmentMovement,
} from "@/features/accounts/api";
import { useT } from "@/i18n/i18n-provider";

type Movement = components["schemas"]["InvestmentMovement"];
type ConfirmBody = Parameters<
  ReturnType<typeof useConfirmInvestmentMovement>["mutateAsync"]
>[0]["body"];

export interface ReviewDialog {
  kind: "application" | "income";
  movement: Movement;
  currency: string;
}

// The actions of the review section: the open dialog and the text of the last failure.
export function useInvestmentReview() {
  const t = useT();
  const confirm = useConfirmInvestmentMovement();
  const dismiss = useDismissInvestmentMovement();
  const undo = useUndoInvestmentMovement();
  const [dialog, setDialog] = useState<ReviewDialog | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pending = confirm.isPending || dismiss.isPending || undo.isPending;

  function handleConfirm(movement: Movement) {
    const kind = movement.proposal;
    if (kind === "application" || kind === "income") {
      setDialog({ kind, movement, currency: movement.amount.currency });
      return;
    }
    run(confirm.mutateAsync({ id: movement.id, body: {} }));
  }

  function handleSubmit(movement: Movement, body: ConfirmBody) {
    setDialog(null);
    run(confirm.mutateAsync({ id: movement.id, body }));
  }

  function handleDismiss(movement: Movement) {
    run(dismiss.mutateAsync(movement.id));
  }

  function handleUndo(movement: Movement) {
    run(undo.mutateAsync(movement.id));
  }

  function handleCloseDialog() {
    setDialog(null);
  }

  function run(action: Promise<unknown>) {
    setError(null);
    action.catch((caught: unknown) => {
      setError(errorText(caught, t));
    });
  }

  return {
    dialog,
    error,
    pending,
    handleConfirm,
    handleSubmit,
    handleDismiss,
    handleUndo,
    handleCloseDialog,
  };
}
