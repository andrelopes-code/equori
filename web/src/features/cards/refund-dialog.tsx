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
import { Stack } from "@slotted/react/stack";
import { useId, useState } from "react";

import { errorText } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { useRefund } from "@/features/cards/api";
import { formatMoney } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { DateInput } from "@/ui/date-input";
import { MoneyInput } from "@/ui/money-input";
import { useStableCallback } from "@/ui/use-stable-callback";
import { useOverlayOpen } from "@/ui/use-overlay-open";

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
  const [locale] = useAppLocale();
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
              amount: formatMoney(
                { amount: charged, currency },
                scale(currency),
                locale,
              ),
            })}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          {/* Workaround for Slotted finding "dialog has no place for a form around its parts". */}
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
            <Stack gap={4}>
              {error !== null && (
                <InlineMessage tone="danger">{error}</InlineMessage>
              )}
              <Field invalid={tooMuch}>
                <FieldLabel>{t("refund.amount")}</FieldLabel>
                <MoneyInput
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
            </Stack>
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
