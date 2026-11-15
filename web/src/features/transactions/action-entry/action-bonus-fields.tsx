import { Field, FieldError, FieldLabel } from "@slotted/react/field";

import { CategoryPicker } from "@/features/categories";
import type { ActionDraft } from "@/features/transactions/action-entry/action-draft";
import { useT } from "@/i18n/i18n-provider";
import { FieldTitle } from "@/ui/form-fields/field-title";
import { FormRow } from "@/ui/form-layout/form-row";
import { PriceInput } from "@/ui/money/price-input";

interface ActionBonusFieldsProps {
  draft: ActionDraft;
  base: string | undefined;
  errors: Record<string, string>;
  onChange: (patch: Partial<ActionDraft>) => void;
}

// The cost per new unit that the company announced and the income category of its value (A228
// IO25). Families read: field.
export function ActionBonusFields({
  draft,
  base,
  errors,
  onChange,
}: ActionBonusFieldsProps) {
  const t = useT();

  return (
    <FormRow>
      <Field width="medium" invalid={errors.unit_cost !== undefined}>
        <FieldTitle
          label={t("action.unitCost")}
          help={t("action.unitCostHelp")}
        />
        <PriceInput
          name="unit_cost"
          value={draft.unitCost}
          currency={base ?? ""}
          onChange={(unitCost) => {
            onChange({ unitCost });
          }}
        />
        {errors.unit_cost !== undefined && (
          <FieldError>{errors.unit_cost}</FieldError>
        )}
      </Field>

      <Field invalid={errors.category_id !== undefined}>
        <FieldLabel>{t("action.category")}</FieldLabel>
        <CategoryPicker
          placeholder={t("entry.categoryPlaceholder")}
          value={draft.categoryId}
          amount={1}
          onChange={(categoryId) => {
            onChange({ categoryId });
          }}
        />
        {errors.category_id !== undefined && (
          <FieldError>{errors.category_id}</FieldError>
        )}
      </Field>
    </FormRow>
  );
}
