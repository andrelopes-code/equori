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
import { useId, useState } from "react";

import { errorText } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { useRefund } from "@/features/cards/api";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { DateInput } from "@/ui/date-input";
import widths from "@/ui/field-width.module.css";
import { FormLayout } from "@/ui/form-layout";
import { MoneyInput } from "@/ui/money-input";
import { useStableCallback } from "@/ui/use-stable-callback";
import { useOverlayOpen } from "@/ui/use-overlay-open";
import { useMoneyFormat } from "@/privacy/use-money-format";

type StatementPosting = components["schemas"]["StatementPosting"];

// M06: all or part of a purchase given back as a credit on the card; the statement the credit
// lands on follows from its date unless the card's bill says otherwise.
export function RefundDialog({
  line,
  scale,
  onDone,
  onCancel,
}: {
  line: StatementPosting;
  scale: (code: string) => number;
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const overlayOpen = useOverlayOpen();
  const fmt = useMoneyFormat();
  const today = useToday();
  const formId = useId();
  const refund = useRefund();
  const currency = line.amount.currency;
  const charged = Math.abs(line.amount.amount);
  const [amount, setAmount] = useState(charged);
  const [date, setDate] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const change = useStableCallback((open: boolean) => {
    if (!open) onCancel();
  });
  const tooMuch = amount > charged;
  return (
    <Dialog open={overlayOpen} size="sm" onOpenChange={change}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("refund.title", { name: line.description })}
          </DialogTitle>
          <DialogDescription>
            {t("refund.hint", {
              amount: fmt.money({ amount: charged, currency }, scale(currency)),
            })}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          {/* Workaround for Slotted issue #8. */}
          <form
            id={formId}
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              if (amount === 0 || tooMuch) return;
              setError(null);
              refund
                .mutateAsync({
                  transactionId: line.transaction_id,
                  body: { date, amount: { amount, currency } },
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

              <Field invalid={tooMuch}>
                <FieldLabel>{t("refund.amount")}</FieldLabel>
                <MoneyInput
                  size="field"
                  className={widths.medium}
                  value={amount}
                  onChange={setAmount}
                  currency={currency}
                  scale={scale(currency)}
                  sign="income"
                />
                <FieldDescription>
                  {tooMuch ? t("refund.tooMuch") : t("refund.amountHint")}
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel>{t("refund.date")}</FieldLabel>
                <DateInput name="date" value={date} onChange={setDate} />
              </Field>
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
            disabled={amount === 0 || tooMuch}
            loading={refund.isPending}
          >
            {t("refund.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
