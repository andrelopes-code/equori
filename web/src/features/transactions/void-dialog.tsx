import { Button } from "@slotted/react/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@slotted/react/dialog";
import { Field, FieldDescription, FieldLabel } from "@slotted/react/field";
import { InlineMessage } from "@slotted/react/inline-message";
import { Textarea } from "@slotted/react/textarea";
import { useState } from "react";

import { errorText } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { useVoidTransaction } from "@/features/transactions/api";
import { useT } from "@/i18n/i18n-provider";

type Transaction = components["schemas"]["Transaction"];

export function VoidDialog({
  transaction,
  open,
  onOpenChange,
}: {
  transaction: Transaction;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();
  const voiding = useVoidTransaction();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setReason("");
          setError(null);
        }
        onOpenChange(next);
      }}
      size="sm"
    >
      <DialogContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            voiding
              .mutateAsync({ current: transaction, reason: reason.trim() })
              .then(() => {
                onOpenChange(false);
              })
              .catch((caught: unknown) => {
                setError(errorText(caught, t));
              });
          }}
        >
          <DialogHeader>
            <DialogTitle>{t("void.title")}</DialogTitle>
            <DialogDescription>{t("void.description")}</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <Field>
              <FieldLabel>{t("void.reason")}</FieldLabel>
              <Textarea
                name="reason"
                required
                maxLength={500}
                value={reason}
                onChange={(event) => {
                  setReason(event.target.value);
                }}
              />
              <FieldDescription>{t("void.reasonHint")}</FieldDescription>
            </Field>
            {error !== null && (
              <InlineMessage tone="danger">{error}</InlineMessage>
            )}
          </DialogBody>
          <DialogFooter>
            <Button
              variant="ghost"
              tone="secondary"
              onClick={() => {
                onOpenChange(false);
              }}
            >
              {t("detail.cancel")}
            </Button>
            <Button
              type="submit"
              tone="danger"
              loading={voiding.isPending}
              disabled={reason.trim() === ""}
            >
              {t("void.confirm")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
