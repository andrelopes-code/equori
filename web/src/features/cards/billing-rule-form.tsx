import { Button } from "@slotted/react/button";
import { Field, FieldLabel } from "@slotted/react/field";
import { InlineMessage } from "@slotted/react/inline-message";
import { Inline } from "@slotted/react/inline";
import { Stack } from "@slotted/react/stack";
import { useState } from "react";

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

type BillingCycleRule = components["schemas"]["BillingCycleRule"];

export function fieldsOf(rule: BillingCycleRule | undefined): BillingFields {
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

// T05: a new version of the billing cycle, from a reference month on; earlier statements keep
// the version they were billed under.
export function BillingRuleForm({
  accountId,
  latest,
  onDone,
  onCancel,
}: {
  accountId: string;
  latest: BillingCycleRule | undefined;
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const today = useToday();
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
  return (
    <form
      aria-label={t("card.newRule")}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (!ready) return;
        setError(null);
        create
          .mutateAsync({
            accountId,
            rule: billingRuleBody({ ...fields, limit: 0, cards: [] }, from),
          })
          .then(onDone)
          .catch((caught: unknown) => {
            setError(errorText(caught, t));
          });
      }}
    >
      <Stack gap={4}>
        <Field>
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
        <BillingRuleFields value={fields} onChange={setFields} errors={{}} />
        {error !== null && <InlineMessage tone="danger">{error}</InlineMessage>}
        <Inline gap={3}>
          <Button type="submit" disabled={!ready} loading={create.isPending}>
            {t("detail.save")}
          </Button>
          <Button variant="ghost" tone="secondary" onClick={onCancel}>
            {t("detail.cancel")}
          </Button>
        </Inline>
      </Stack>
    </form>
  );
}
