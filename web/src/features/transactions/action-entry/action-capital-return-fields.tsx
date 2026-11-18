import { Field, FieldError, FieldLabel } from "@slotted/react/field";

import type { ActionDraft } from "@/features/transactions/action-entry/action-draft";
import { useT } from "@/i18n/i18n-provider";
import { FormRow } from "@/ui/form-layout/form-row";
import { MoneyInput } from "@/ui/money/money-input";

interface ActionCapitalReturnFieldsProps {
  draft: ActionDraft;
  base: string | undefined;
  scale: (code: string) => number;
  errors: Record<string, string>;
  onChange: (patch: Partial<ActionDraft>) => void;
}

// The cash an amortization or a reduction of capital pays back, in the base currency; it lowers
// the cost of the holding (coverage row E-08). Families read: field.
export function ActionCapitalReturnFields({
  draft,
  base,
  scale,
  errors,
  onChange,
}: ActionCapitalReturnFieldsProps) {
  const t = useT();

  return (
    <FormRow>
      <Field required width="medium" invalid={errors.amount !== undefined}>
        <FieldLabel>{t("action.capitalReturn.amount")}</FieldLabel>
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
