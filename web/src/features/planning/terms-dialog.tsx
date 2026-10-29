import { Button } from "@slotted/react/button";
import { Checkbox } from "@slotted/react/checkbox";
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
import { useChangeTerms } from "@/features/planning/api";
import { RecurrenceFields } from "@/features/planning/recurrence-fields";
import { useScale } from "@/features/setup";
import { formatDate, shiftDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { DateInput } from "@/ui/date-input";
import widths from "@/ui/field-width.module.css";
import { FormLayout } from "@/ui/form-layout";
import { MoneyInput } from "@/ui/money-input";
import { useOverlayOpen } from "@/ui/use-overlay-open";
import { useStableCallback } from "@/ui/use-stable-callback";

type Schedule = components["schemas"]["Schedule"];

// A new terms version from a date after the latest one: the amount, the recurrence or both.
export function TermsDialog({
  schedule,
  onDone,
  onCancel,
}: {
  schedule: Schedule;
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const today = useToday();
  const formId = useId();
  const scale = useScale();
  const overlayOpen = useOverlayOpen();
  const change = useChangeTerms();
  const latest = schedule.terms.at(-1);
  const after = latest?.effective_from ?? today;
  const [from, setFrom] = useState(
    shiftDate(after, 1) > today ? shiftDate(after, 1) : today,
  );
  const [amount, setAmount] = useState(0);
  const [withRecurrence, setWithRecurrence] = useState(false);
  const [recurrence, setRecurrence] = useState(latest?.recurrence);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<string | null>(null);
  const currency = latest?.amount.currency;
  const openChange = useStableCallback((open: boolean) => {
    if (!open) onCancel();
  });
  return (
    <Dialog open={overlayOpen} size="lg" onOpenChange={openChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("schedule.changeTerms")}</DialogTitle>
          <DialogDescription>
            {t("schedule.changeTermsHint", { date: formatDate(after, locale) })}
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
                next.effective_from = t("schedule.required.after", {
                  date: formatDate(after, locale),
                });
              if (amount === 0 && !withRecurrence)
                next.amount = t("schedule.required.change");
              setErrors(next);
              setSummary(null);
              if (Object.keys(next).length > 0 || currency === undefined)
                return;
              change
                .mutateAsync({
                  id: schedule.id,
                  terms: {
                    effective_from: from,
                    ...(amount === 0 ? {} : { amount: { amount, currency } }),
                    ...(withRecurrence && recurrence !== undefined
                      ? { recurrence }
                      : {}),
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

              <Field invalid={errors.effective_from !== undefined} required>
                <FieldLabel>{t("schedule.effectiveFrom")}</FieldLabel>
                <DateInput
                  name="effective_from"
                  value={from}
                  min={shiftDate(after, 1)}
                  shortcuts={false}
                  onChange={setFrom}
                />
                {errors.effective_from !== undefined && (
                  <FieldError>{errors.effective_from}</FieldError>
                )}
              </Field>

              <Field invalid={errors.amount !== undefined}>
                <FieldLabel>{t("schedule.amount")}</FieldLabel>
                {currency !== undefined && scale !== null && (
                  <MoneyInput
                    size="field"
                    className={widths.medium}
                    value={amount}
                    onChange={setAmount}
                    currency={currency}
                    scale={scale(currency)}
                    sign={schedule.kind === "income" ? "income" : "expense"}
                  />
                )}

                {errors.amount !== undefined && (
                  <FieldError>{errors.amount}</FieldError>
                )}
              </Field>

              <Checkbox
                checked={withRecurrence}
                onCheckedChange={setWithRecurrence}
              >
                {t("schedule.changeRecurrence")}
              </Checkbox>

              {withRecurrence && recurrence !== undefined && (
                <RecurrenceFields value={recurrence} onChange={setRecurrence} />
              )}
            </FormLayout>
          </form>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" tone="secondary" onClick={onCancel}>
            {t("detail.cancel")}
          </Button>
          <Button type="submit" form={formId} loading={change.isPending}>
            {t("schedule.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
