import { Alert, AlertContent, AlertDescription } from "@slotted/react/alert";
import { Button } from "@slotted/react/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@slotted/react/dialog";
import { Field, FieldLabel } from "@slotted/react/field";
import { TextField } from "@slotted/react/text-field";
import { toast } from "@slotted/react/toast";
import { useState } from "react";

import { ProblemError, problemMessage } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { useVoidTransaction } from "@/features/transactions/api";
import { useT } from "@/i18n/i18n-provider";

// Mounted only while open, so every opening starts with an empty reason.
export function VoidDialog({
  transaction,
  onClose,
}: {
  transaction: components["schemas"]["Transaction"];
  onClose: () => void;
}) {
  const t = useT();
  const voidTransaction = useVoidTransaction();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const trimmed = reason.trim();

  const submit = async () => {
    setError(null);
    try {
      await voidTransaction.mutateAsync({
        current: transaction,
        reason: trimmed,
      });
    } catch (failure) {
      setError(
        failure instanceof ProblemError
          ? problemMessage(failure.problem, t)
          : t("transaction.failed"),
      );
      return;
    }
    toast.show({ title: t("transaction.void.done") });
    onClose();
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("transaction.void.title")}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <Field>
            <FieldLabel>{t("transaction.void.reason")}</FieldLabel>
            <TextField value={reason} onValueChange={setReason} />
          </Field>
          {error !== null && (
            <Alert tone="danger" role="alert">
              <AlertContent>
                <AlertDescription>{error}</AlertDescription>
              </AlertContent>
            </Alert>
          )}
        </DialogBody>
        <DialogFooter>
          <Button tone="secondary" variant="outline" onClick={onClose}>
            {t("transaction.cancel")}
          </Button>
          <Button
            tone="danger"
            disabled={trimmed === "" || voidTransaction.isPending}
            onClick={() => void submit()}
          >
            {t("transaction.void.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
