import { Button } from "@slotted/react/button";
import {
  Collapsible,
  CollapsibleHeader,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@slotted/react/collapsible";
import { Field, FieldError, FieldLabel } from "@slotted/react/field";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

import { AmortizationRow } from "@/features/instruments/terms/amortization-row";
import {
  interestKeys,
  interestPeriods,
  type PaymentsDraft,
} from "@/features/instruments/terms/payments-draft";
import { useT } from "@/i18n/i18n-provider";
import { ChoiceSelect } from "@/ui/form-fields/choice-select";
import { DateInput } from "@/ui/form-fields/date-input";
import { FormSection } from "@/ui/form-layout/form-section";

interface PaymentsFieldsProps {
  draft: PaymentsDraft;
  // The problems of the body, keyed by the field of the API.
  errors: Record<string, string>;
  onChange: (draft: PaymentsDraft) => void;
}

// The interest schedule and the amortizations of a contract. Collapsed while the draft holds
// none, as most securities pay everything at maturity.
export function PaymentsFields({
  draft,
  errors,
  onChange,
}: PaymentsFieldsProps) {
  const t = useT();
  const choices = interestPeriods.map((every) => ({
    value: String(every),
    label: t(interestKeys[every]),
  }));

  const handleAdd = () => {
    onChange({
      ...draft,
      amortizations: [...draft.amortizations, { paysOn: "", percent: "" }],
    });
  };

  return (
    <Collapsible
      variant="framed"
      size="sm"
      defaultOpen={draft.every > 0 || draft.amortizations.length > 0}
    >
      <CollapsibleHeader>
        <CollapsibleTrigger>{t("terms.payments")}</CollapsibleTrigger>
      </CollapsibleHeader>

      <CollapsiblePanel>
        <Stack gap={4}>
          <Text size="sm" tone="muted">
            {t("terms.paymentsHint")}
          </Text>

          <Field>
            <FieldLabel>{t("terms.interestEvery")}</FieldLabel>
            <ChoiceSelect
              label={t("terms.interestEvery")}
              choices={choices}
              value={String(draft.every)}
              multiple={false}
              onChange={(next) => {
                const every = interestPeriods.find((p) => String(p) === next);
                if (every !== undefined) onChange({ ...draft, every });
              }}
            />
          </Field>

          {draft.every > 0 && (
            <Field invalid={errors.first_payment_on !== undefined} required>
              <FieldLabel>{t("terms.firstPaymentOn")}</FieldLabel>
              <DateInput
                name="first_payment_on"
                value={draft.first}
                shortcuts={false}
                onChange={(first) => {
                  onChange({ ...draft, first });
                }}
              />
              {errors.first_payment_on !== undefined && (
                <FieldError>{errors.first_payment_on}</FieldError>
              )}
            </Field>
          )}

          <FormSection legend={t("terms.amortizations")}>
            {draft.amortizations.map((row, index) => (
              <AmortizationRow
                // The rows have no identity beyond their place.
                key={index}
                row={row}
                error={errors[`payments[${String(index)}]`]}
                onChange={(next) => {
                  onChange({
                    ...draft,
                    amortizations: draft.amortizations.map((r, i) =>
                      i === index ? next : r,
                    ),
                  });
                }}
                onRemove={() => {
                  onChange({
                    ...draft,
                    amortizations: draft.amortizations.filter(
                      (_, i) => i !== index,
                    ),
                  });
                }}
              />
            ))}
            {errors.payments !== undefined && (
              <Text tone="danger" size="sm">
                {errors.payments}
              </Text>
            )}
            <Button
              variant="ghost"
              tone="secondary"
              size="sm"
              onClick={handleAdd}
            >
              {t("terms.amortizationAdd")}
            </Button>
          </FormSection>
        </Stack>
      </CollapsiblePanel>
    </Collapsible>
  );
}
