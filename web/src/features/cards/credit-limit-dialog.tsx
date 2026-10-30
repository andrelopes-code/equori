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
import { InlineMessage } from "@slotted/react/inline-message";
import { useId, useState } from "react";

import { errorText } from "@/api/problem";
import { useCreateCreditLimit } from "@/features/cards/api";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { DateInput } from "@/ui/date-input";
import widths from "@/ui/field-width.module.css";
import { FormLayout } from "@/ui/form-layout";
import { FormRow } from "@/ui/form-row";
import { MoneyInput } from "@/ui/money-input";
import { useOverlayOpen } from "@/ui/use-overlay-open";
import { useStableCallback } from "@/ui/use-stable-callback";

interface CreditLimitDialogProps {
  accountId: string;
  currency: string;
  scale: number;
  onDone: () => void;
  onCancel: () => void;
}

// A new version of the credit limit from a day on; the free limit follows from it.
export function CreditLimitDialog({
  accountId,
  currency,
  scale,
  onDone,
  onCancel,
}: CreditLimitDialogProps) {
  const t = useT();
  const today = useToday();
  const overlayOpen = useOverlayOpen();
  const formId = useId();
  const create = useCreateCreditLimit();

  const [amount, setAmount] = useState(0);
  const [from, setFrom] = useState(today);
  const [error, setError] = useState<string | null>(null);

  const change = useStableCallback((open: boolean) => {
    if (!open) onCancel();
  });

  return (
    <Dialog open={overlayOpen} size="sm" onOpenChange={change}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("card.newLimit")}</DialogTitle>
        </DialogHeader>

        <DialogBody>
          {/* Workaround for Slotted issue #8. */}
          <form
            id={formId}
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              setError(null);
              create
                .mutateAsync({
                  accountId,
                  limit: { effective_from: from, amount: { amount, currency } },
                })
                .then(onDone)
                .catch((caught: unknown) => {
                  setError(errorText(caught, t));
                });
            }}
          >
            <FormLayout>
              {error !== null && (
                <InlineMessage tone="danger">{error}</InlineMessage>
              )}

              <FormRow>
                <Field required>
                  <FieldLabel>{t("accountForm.limit")}</FieldLabel>
                  <MoneyInput
                    size="field"
                    value={amount}
                    onChange={setAmount}
                    currency={currency}
                    scale={scale}
                    sign="neutral"
                  />
                </Field>

                <Field required>
                  <FieldLabel>{t("card.limitFrom")}</FieldLabel>
                  <DateInput
                    name="effective_from"
                    className={widths.fill}
                    value={from}
                    onChange={setFrom}
                  />
                </Field>
              </FormRow>
            </FormLayout>
          </form>
        </DialogBody>

        <DialogFooter>
          <Button variant="ghost" tone="secondary" onClick={onCancel}>
            {t("detail.cancel")}
          </Button>
          <Button
            type="submit"
            form={formId}
            disabled={amount === 0}
            loading={create.isPending}
          >
            {t("detail.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
