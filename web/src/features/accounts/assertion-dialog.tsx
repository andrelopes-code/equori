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
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@slotted/react/field";
import { Stack } from "@slotted/react/stack";
import { useId, useState } from "react";

import { ProblemError, errorText, fieldErrors } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { useCreateAssertion } from "@/features/accounts/api";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { DateInput } from "@/ui/date-input";
import { MoneyInput } from "@/ui/money-input";
import { useOverlayOpen } from "@/ui/use-overlay-open";
import { useStableCallback } from "@/ui/use-stable-callback";

type Account = components["schemas"]["Account"];
type AssertionResult = components["schemas"]["AssertionResult"];

// The institution's balance on a day, recorded in a dialog: a form opened in place inside the
// section went unnoticed (owner review item 13). A liability's balance is what is owed, typed as
// a positive amount and sent negative.
export function AssertionDialog({
  account,
  scale,
  onDone,
  onCancel,
}: {
  account: Account;
  scale: number;
  onDone: (result: AssertionResult) => void;
  onCancel: () => void;
}) {
  const t = useT();
  const overlayOpen = useOverlayOpen();
  const formId = useId();
  const today = useToday();
  const create = useCreateAssertion();
  const [date, setDate] = useState(today);
  const [amount, setAmount] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<string | null>(null);
  const owed = account.class === "liability";
  const amountError = errors.amount ?? summary ?? undefined;
  const change = useStableCallback((open: boolean) => {
    if (!open) onCancel();
  });
  return (
    <Dialog open={overlayOpen} size="sm" onOpenChange={change}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("reconciliation.formTitle")}</DialogTitle>
          <DialogDescription>{t("reconciliation.formHint")}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          {/* Workaround for Slotted issue #8. */}
          <form
            id={formId}
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              setErrors({});
              setSummary(null);
              create
                .mutateAsync({
                  id: account.id,
                  date,
                  amount: {
                    amount: owed ? -amount : amount,
                    currency: account.currency,
                  },
                })
                .then(onDone)
                .catch((caught: unknown) => {
                  if (caught instanceof ProblemError)
                    setErrors(fieldErrors(caught.problem));
                  setSummary(errorText(caught, t));
                });
            }}
          >
            <Stack gap={4}>
              <Field invalid={errors.date !== undefined}>
                <FieldLabel>{t("reconciliation.date")}</FieldLabel>
                <DateInput
                  name="date"
                  value={date}
                  onChange={setDate}
                  max={today}
                />
                {errors.date !== undefined && (
                  <FieldError>{errors.date}</FieldError>
                )}
              </Field>
              <Field invalid={errors.amount !== undefined || summary !== null}>
                <FieldLabel>
                  {t(
                    owed
                      ? "reconciliation.amountOwed"
                      : "reconciliation.amount",
                  )}
                </FieldLabel>
                <MoneyInput
                  value={amount}
                  onChange={setAmount}
                  currency={account.currency}
                  scale={scale}
                  sign="neutral"
                />
                <FieldDescription>
                  {t("reconciliation.amountHint")}
                </FieldDescription>
                {amountError !== undefined && (
                  <FieldError>{amountError}</FieldError>
                )}
              </Field>
            </Stack>
          </form>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" tone="secondary" onClick={onCancel}>
            {t("detail.cancel")}
          </Button>
          <Button type="submit" form={formId} loading={create.isPending}>
            {t("reconciliation.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
