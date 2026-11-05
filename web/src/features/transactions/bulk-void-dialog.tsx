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
import { Textarea } from "@slotted/react/textarea";
import { Text } from "@slotted/react/typography";
import { useState } from "react";

import { errorText } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { useScale } from "@/features/setup";
import { useVoidTransactions } from "@/features/transactions/api";
import { useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { bulkOutcome } from "@/ui/bulk-outcome";
import type { BulkOutcome } from "@/ui/bulk-outcome";
import { FormNotice } from "@/ui/form-notice";
import { useStableCallback } from "@/ui/use-stable-callback";

type Money = components["schemas"]["Money"];

interface BulkVoidDialogProps {
  ids: readonly string[];
  // The sum of the selection; absent when the rows hold more than one currency.
  amount?: Money;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: (outcome: BulkOutcome) => void;
}

export function BulkVoidDialog({
  ids,
  amount,
  open,
  onOpenChange,
  onDone,
}: BulkVoidDialogProps) {
  const t = useT();
  const fmt = useMoneyFormat();
  const scale = useScale();
  const voiding = useVoidTransactions();

  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const change = useStableCallback((next: boolean) => {
    if (!next) {
      setReason("");
      setError(null);
    }
    onOpenChange(next);
  });

  function handleSubmit(event: React.SyntheticEvent) {
    event.preventDefault();
    setError(null);
    voiding
      .mutateAsync({ ids, reason: reason.trim() })
      .then((results) => {
        change(false);
        onDone(bulkOutcome(results, "voided"));
      })
      .catch((caught: unknown) => {
        setError(errorText(caught, t));
      });
  }

  return (
    <Dialog open={open} onOpenChange={change} size="sm">
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {t("bulkVoid.title", { count: ids.length })}
            </DialogTitle>
            <DialogDescription>{t("bulkVoid.description")}</DialogDescription>
          </DialogHeader>

          <DialogBody>
            {amount !== undefined && scale !== null && (
              <Text>
                {t("bulk.total", {
                  amount: fmt.signed(amount, scale(amount.currency)),
                })}
              </Text>
            )}

            <Field required>
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

            {error !== null && <FormNotice>{error}</FormNotice>}
          </DialogBody>

          <DialogFooter>
            <Button
              variant="ghost"
              tone="secondary"
              onClick={() => {
                change(false);
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
