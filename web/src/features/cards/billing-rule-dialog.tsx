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
import type { components } from "@/api/schema.gen";
import { BillingRuleFields, billingRuleBody } from "@/features/accounts";
import type { BillingFields } from "@/features/accounts";
import { useCreateBillingRule } from "@/features/cards/api";
import { addMonths, currentMonth } from "@/features/cards/reference-months";
import { formatMonthTitle } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { ChoiceSelect } from "@/ui/choice-select";
import { FormLayout } from "@/ui/form-layout";
import { useOverlayOpen } from "@/ui/use-overlay-open";
import { useStableCallback } from "@/ui/use-stable-callback";

type BillingCycleRule = components["schemas"]["BillingCycleRule"];

interface BillingRuleDialogProps {
  accountId: string;
  latest: BillingCycleRule | undefined;
  onDone: () => void;
  onCancel: () => void;
}

// T05: a new version of the billing cycle, from a reference month on; earlier statements keep
// the version they were billed under.
export function BillingRuleDialog({
  accountId,
  latest,
  onDone,
  onCancel,
}: BillingRuleDialogProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const today = useToday();
  const overlayOpen = useOverlayOpen();
  const formId = useId();
  const create = useCreateBillingRule();

  const [fields, setFields] = useState<BillingFields>(() => fieldsOf(latest));
  const [from, setFrom] = useState(addMonths(currentMonth(today), 1));
  const [error, setError] = useState<string | null>(null);

  const months = Array.from({ length: 6 }, (_, i) =>
    addMonths(currentMonth(today), i - 1),
  );
  const ready =
    fields.dueDay !== null &&
    (fields.closingMode === "day"
      ? fields.closingDay !== null
      : fields.closingDaysBeforeDue !== null);

  const change = useStableCallback((open: boolean) => {
    if (!open) onCancel();
  });

  return (
    <Dialog open={overlayOpen} size="md" onOpenChange={change}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("card.newRule")}</DialogTitle>
        </DialogHeader>

        <DialogBody>
          {/* Workaround for Slotted issue #8. */}
          <form
            id={formId}
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              if (!ready) return;
              setError(null);
              create
                .mutateAsync({
                  accountId,
                  rule: billingRuleBody(
                    { ...fields, limit: 0, cards: [] },
                    from,
                  ),
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

              <Field required>
                <FieldLabel>{t("card.effectiveFrom")}</FieldLabel>
                <ChoiceSelect
                  label={t("card.effectiveFrom")}
                  choices={months.map((m) => ({
                    value: m,
                    label: formatMonthTitle(m, locale),
                  }))}
                  value={from}
                  multiple={false}
                  onChange={(next) => {
                    if (typeof next === "string") setFrom(next);
                  }}
                />
              </Field>

              <BillingRuleFields
                value={fields}
                onChange={setFields}
                errors={{}}
                fill
              />
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
            disabled={!ready}
            loading={create.isPending}
          >
            {t("detail.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function fieldsOf(rule: BillingCycleRule | undefined): BillingFields {
  return {
    closingMode: rule?.closing_mode ?? "day",
    closingDay: rule?.closing_day ?? null,
    closingDaysBeforeDue: rule?.closing_days_before_due ?? null,
    dueDay: rule?.due_day ?? null,
    closingAdjustment: rule?.closing_adjustment ?? "none",
    dueDateAdjustment: rule?.due_date_adjustment ?? "following",
    assignment: rule?.closing_day_assignment ?? "next",
  };
}
