import { Field, FieldError, FieldLabel } from "@slotted/react/field";

import { CategoryPicker } from "@/features/categories";
import type { IncomeDraft } from "@/features/transactions/income-entry/income-draft";
import { useT } from "@/i18n/i18n-provider";

interface IncomeCategoryFieldsProps {
  draft: IncomeDraft;
  errors: Record<string, string>;
  onChange: (patch: Partial<IncomeDraft>) => void;
}

// The category of the gross amount and, with tax withheld, the category of the tax.
export function IncomeCategoryFields({
  draft,
  errors,
  onChange,
}: IncomeCategoryFieldsProps) {
  const t = useT();

  return (
    <>
      <Field required invalid={errors.category_id !== undefined}>
        <FieldLabel>{t("income.category")}</FieldLabel>
        <CategoryPicker
          placeholder={t("entry.categoryPlaceholder")}
          value={draft.categoryId}
          amount={1}
          onChange={(id) => {
            onChange({ categoryId: id });
          }}
        />
        {errors.category_id !== undefined && (
          <FieldError>{errors.category_id}</FieldError>
        )}
      </Field>

      {draft.withheld > 0 && (
        <Field invalid={errors.withheld_category_id !== undefined}>
          <FieldLabel>{t("income.withheldCategory")}</FieldLabel>
          <CategoryPicker
            placeholder={t("income.withheldCategoryPlaceholder")}
            value={draft.withheldCategoryId}
            amount={-1}
            onChange={(id) => {
              onChange({ withheldCategoryId: id });
            }}
          />
          {errors.withheld_category_id !== undefined && (
            <FieldError>{errors.withheld_category_id}</FieldError>
          )}
        </Field>
      )}
    </>
  );
}
