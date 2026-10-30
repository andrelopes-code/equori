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
import { Field, FieldError, FieldLabel } from "@slotted/react/field";
import { InlineMessage } from "@slotted/react/inline-message";
import { useId, useState } from "react";

import { errorText } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { addMonths } from "@/features/cards";
import { useAddBudgetAmount } from "@/features/planning/api";
import { useScale } from "@/features/setup";
import { formatMonthTitle } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { FormLayout } from "@/ui/form-layout";
import { FormRow } from "@/ui/form-row";
import { MoneyInput } from "@/ui/money-input";
import { MonthControl } from "@/ui/month-control";
import { useOverlayOpen } from "@/ui/use-overlay-open";
import { useStableCallback } from "@/ui/use-stable-callback";

type Budget = components["schemas"]["Budget"];

// A new amount of a budget from a month after the latest one (T09).
export function BudgetAmountDialog({
  budget,
  onDone,
  onCancel,
}: {
  budget: Budget;
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const today = useToday();
  const formId = useId();
  const scale = useScale();
  const overlayOpen = useOverlayOpen();
  const add = useAddBudgetAmount();
  const latest = budget.amounts.at(-1);
  const after = latest?.effective_from ?? addMonths(today.slice(0, 7), -1);
  const [from, setFrom] = useState(() => {
    const next = addMonths(after, 1);
    return next > today.slice(0, 7) ? next : today.slice(0, 7);
  });
  const [amount, setAmount] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<string | null>(null);
  const currency = latest?.amount.currency;
  const openChange = useStableCallback((open: boolean) => {
    if (!open) onCancel();
  });
  return (
    <Dialog open={overlayOpen} size="md" onOpenChange={openChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("budget.addAmount")}</DialogTitle>
          <DialogDescription>
            {t("budget.addAmountHint", {
              month: formatMonthTitle(after, locale),
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
              const next: Record<string, string> = {};
              if (from <= after)
                next.effective_from = t("budget.required.after", {
                  month: formatMonthTitle(after, locale),
                });
              if (amount <= 0) next.amount = t("budget.required.amount");
              setErrors(next);
              setSummary(null);
              if (Object.keys(next).length > 0 || currency === undefined)
                return;
              add
                .mutateAsync({
                  id: budget.id,
                  amount: {
                    effective_from: from,
                    amount: { amount, currency },
                  },
                })
                .then(onDone)
                .catch((caught: unknown) => {
                  setSummary(errorText(caught, t));
                });
            }}
          >
            <FormLayout>
              {summary !== null && (
                <InlineMessage tone="danger">{summary}</InlineMessage>
              )}
              <FormRow>
                <Field invalid={errors.effective_from !== undefined} required>
                  <FieldLabel>{t("budget.from")}</FieldLabel>
                  <MonthControl
                    label={t("budget.from")}
                    value={from}
                    onChange={setFrom}
                  />
                  {errors.effective_from !== undefined && (
                    <FieldError>{errors.effective_from}</FieldError>
                  )}
                </Field>

                <Field invalid={errors.amount !== undefined} required>
                  <FieldLabel>{t("budget.amount")}</FieldLabel>
                  {currency !== undefined && scale !== null && (
                    <MoneyInput
                      size="field"
                      value={amount}
                      onChange={setAmount}
                      currency={currency}
                      scale={scale(currency)}
                      sign="neutral"
                    />
                  )}
                  {errors.amount !== undefined && (
                    <FieldError>{errors.amount}</FieldError>
                  )}
                </Field>
              </FormRow>
            </FormLayout>
          </form>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" tone="secondary" onClick={onCancel}>
            {t("detail.cancel")}
          </Button>
          <Button type="submit" form={formId} loading={add.isPending}>
            {t("budget.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
