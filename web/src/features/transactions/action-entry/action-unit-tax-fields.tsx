import { Field, FieldError, FieldLabel } from "@slotted/react/field";

import type { ActionDraft } from "@/features/transactions/action-entry/action-draft";
import { useT } from "@/i18n/i18n-provider";
import { FormRow } from "@/ui/form-layout/form-row";
import { MoneyInput } from "@/ui/money/money-input";

interface ActionUnitTaxFieldsProps {
  draft: ActionDraft;
  instrument: string | null;
  base: string | undefined;
  scale: (code: string) => number;
  errors: Record<string, string>;
  onChange: (patch: Partial<ActionDraft>) => void;
}

// The units a fund cancels and the income tax it withholds (FC25). Families read: field.
export function ActionUnitTaxFields({
  draft,
  instrument,
  base,
  scale,
  errors,
  onChange,
}: ActionUnitTaxFieldsProps) {
  const t = useT();

  return (
    <FormRow>
      <Field required width="medium" invalid={errors.quantity !== undefined}>
        <FieldLabel>{t("action.unitTax.quantity")}</FieldLabel>
        <MoneyInput
          size="field"
          value={draft.quantity}
          currency={instrument ?? ""}
          scale={instrument === null ? 0 : scale(instrument)}
          sign="neutral"
          onChange={(quantity) => {
            onChange({ quantity });
          }}
        />
        {errors.quantity !== undefined && (
          <FieldError>{errors.quantity}</FieldError>
        )}
      </Field>

      <Field required width="medium" invalid={errors.amount !== undefined}>
        <FieldLabel>{t("action.unitTax.amount")}</FieldLabel>
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
    </FormRow>
  );
}
