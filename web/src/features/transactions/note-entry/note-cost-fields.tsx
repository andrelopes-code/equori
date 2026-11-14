import { Field, FieldError, FieldLabel } from "@slotted/react/field";

import { CategoryPicker } from "@/features/categories";
import type { NoteDraft } from "@/features/transactions/note-entry/note-draft";
import { useT } from "@/i18n/i18n-provider";
import { FieldTitle } from "@/ui/form-fields/field-title";
import { FormRow } from "@/ui/form-layout/form-row";
import { MoneyInput } from "@/ui/money/money-input";

interface NoteCostFieldsProps {
  draft: NoteDraft;
  base: string | undefined;
  baseScale: number;
  // The withheld tax is allocated to the sales; a note with none has no field for it.
  sale: boolean;
  errors: Record<string, string>;
  onChange: (patch: Partial<NoteDraft>) => void;
}

// The costs of the whole note and, when it holds a sale, the income tax withheld on it.
export function NoteCostFields({
  draft,
  base,
  baseScale,
  sale,
  errors,
  onChange,
}: NoteCostFieldsProps) {
  const t = useT();

  return (
    <>
      <FormRow>
        <Field width="medium" invalid={errors.fees !== undefined}>
          <FieldTitle label={t("note.fees")} help={t("note.feesHelp")} />
          <MoneyInput
            size="field"
            value={draft.fees}
            currency={base ?? ""}
            scale={baseScale}
            sign="neutral"
            onChange={(fees) => {
              onChange({ fees });
            }}
          />
          {errors.fees !== undefined && <FieldError>{errors.fees}</FieldError>}
        </Field>

        {sale && (
          <Field width="medium" invalid={errors.taxes !== undefined}>
            <FieldLabel>{t("note.taxes")}</FieldLabel>
            <MoneyInput
              size="field"
              value={draft.taxes}
              currency={base ?? ""}
              scale={baseScale}
              sign="neutral"
              onChange={(taxes) => {
                onChange({ taxes });
              }}
            />
            {errors.taxes !== undefined && (
              <FieldError>{errors.taxes}</FieldError>
            )}
          </Field>
        )}
      </FormRow>

      {sale && draft.taxes > 0 && (
        <Field invalid={errors.taxes_category_id !== undefined}>
          <FieldLabel>{t("trade.taxesCategory")}</FieldLabel>
          <CategoryPicker
            placeholder={t("trade.taxesCategoryPlaceholder")}
            value={draft.taxesCategoryId}
            amount={-1}
            onChange={(id) => {
              onChange({ taxesCategoryId: id });
            }}
          />
          {errors.taxes_category_id !== undefined && (
            <FieldError>{errors.taxes_category_id}</FieldError>
          )}
        </Field>
      )}
    </>
  );
}
