import { Field, FieldError, FieldLabel } from "@slotted/react/field";
import { TextField } from "@slotted/react/text-field";

import type { ActionDraft } from "@/features/transactions/action-entry/action-draft";
import { useT } from "@/i18n/i18n-provider";
import { FieldTitle } from "@/ui/form-fields/field-title";
import { FormRow } from "@/ui/form-layout/form-row";
import { MoneyInput } from "@/ui/money/money-input";

interface ActionExchangeFieldsProps {
  draft: ActionDraft;
  base: string | undefined;
  scale: (code: string) => number;
  errors: Record<string, string>;
  onChange: (patch: Partial<ActionDraft>) => void;
}

// The security a conversion, a spin-off or a right gives; for a spin-off, the share of the cost
// its notice moves to it (coverage row E-07); for a right exercise, the price paid in the base
// currency (coverage row E-06). Families read: field, text-field.
export function ActionExchangeFields({
  draft,
  base,
  scale,
  errors,
  onChange,
}: ActionExchangeFieldsProps) {
  const t = useT();

  return (
    <FormRow>
      <Field
        required
        width="medium"
        invalid={errors.new_instrument !== undefined}
      >
        <FieldLabel>{t("action.newInstrument")}</FieldLabel>
        <TextField
          name="new_instrument"
          value={draft.newInstrument}
          maxLength={20}
          onChange={(event) => {
            onChange({ newInstrument: event.target.value.toUpperCase() });
          }}
        />
        {errors.new_instrument !== undefined && (
          <FieldError>{errors.new_instrument}</FieldError>
        )}
      </Field>

      {draft.kind === "spin_off" && (
        <Field required width="short" invalid={errors.cost_bp !== undefined}>
          <FieldTitle
            label={t("action.costPercent")}
            help={t("action.costPercentHelp")}
          />
          <TextField
            name="cost_percent"
            inputMode="decimal"
            value={draft.costPercent}
            onChange={(event) => {
              onChange({ costPercent: event.target.value });
            }}
          />
          {errors.cost_bp !== undefined && (
            <FieldError>{errors.cost_bp}</FieldError>
          )}
        </Field>
      )}

      {draft.kind === "right_exercise" && (
        <Field required width="medium" invalid={errors.amount !== undefined}>
          <FieldLabel>{t("action.rightExercise.amount")}</FieldLabel>
          <MoneyInput
            size="field"
            value={draft.amount}
            currency={base ?? ""}
            scale={base === undefined ? 0 : scale(base)}
            sign="neutral"
            onChange={(amount) => {
              onChange({ amount });
            }}
          />
          {errors.amount !== undefined && (
            <FieldError>{errors.amount}</FieldError>
          )}
        </Field>
      )}
    </FormRow>
  );
}
