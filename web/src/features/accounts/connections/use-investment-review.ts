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

interface ConfirmStep {
  movement: Movement;
  body: ConfirmBody;
}

export interface ReviewDialog {
  kind: "application" | "income";
  movement: Movement;
  currency: string;
  // MB1: the movements confirmed after this application, with an empty body.
  rest?: Movement[];
}

// The actions of the review section: the open dialog and the text of the last failure.
export function useInvestmentReview() {
  const t = useT();
  const confirm = useConfirmInvestmentMovement();
  const dismiss = useDismissInvestmentMovement();
  const undo = useUndoInvestmentMovement();
  const [dialog, setDialog] = useState<ReviewDialog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);

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
    const rest = dialog?.rest;
    setDialog(null);
    if (rest === undefined) {
      run(confirm.mutateAsync({ id: movement.id, body }));
      return;
    }
    run(confirmInOrder([{ movement, body }, ...rest.map(withEmptyBody)]));
  }

  function handleConfirmAll(movements: Movement[]) {
    const [first, ...rest] = movements;
    if (first?.proposal === "application") {
      setDialog({
        kind: "application",
        movement: first,
        currency: first.amount.currency,
        rest,
      });
      return;
    }
    run(confirmInOrder(movements.map(withEmptyBody)));
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
    setDone(null);
    action.catch((caught: unknown) => {
      setError(errorText(caught, t));
    });
  }

  // Stops at the first failure; the movements confirmed before it stay confirmed.
  async function confirmInOrder(steps: ConfirmStep[]) {
    for (const { movement, body } of steps) {
      await confirm.mutateAsync({ id: movement.id, body });
    }
    setDone(steps.length);
  }

  return {
    dialog,
    error,
    done,
    pending,
    handleConfirm,
    handleSubmit,
    handleConfirmAll,
    handleDismiss,
    handleUndo,
    handleCloseDialog,
  };
}

function withEmptyBody(movement: Movement): ConfirmStep {
  return { movement, body: {} };
}
