import { Field, FieldError, FieldLabel } from "@slotted/react/field";

import type { components } from "@/api/schema.gen";
import { CategoryPicker } from "@/features/categories";
import { PayeeField } from "@/features/transactions/payee-field";
import { useT } from "@/i18n/i18n-provider";
import { FieldTitle } from "@/ui/field-title";

type Payee = components["schemas"]["Payee"];

export interface EntryClassificationFieldsProps {
  kind: "expense" | "income";
  categoryId: string | null;
  payeeId: string | null;
  payees: readonly Payee[];
  errors: Record<string, string>;
  onCategory: (id: string | null) => void;
  onPayee: (id: string | null) => void;
}

// The category and the payee of an expense or an income.
export function EntryClassificationFields({
  kind,
  categoryId,
  payeeId,
  payees,
  errors,
  onCategory,
  onPayee,
}: EntryClassificationFieldsProps) {
  const t = useT();

  return (
    <>
      <Field invalid={errors.category !== undefined}>
        <FieldLabel>{t("category.label")}</FieldLabel>
        <CategoryPicker
          placeholder={t("entry.categoryPlaceholder")}
          value={categoryId}
          amount={kind === "income" ? 1 : -1}
          onChange={onCategory}
        />
        {errors.category !== undefined && (
          <FieldError>{errors.category}</FieldError>
        )}
      </Field>

      <Field invalid={errors.payee_id !== undefined}>
        <FieldTitle label={t("facts.payee")} help={t("facts.payeeHelp")} />
        <PayeeField
          placeholder={t("entry.payeePlaceholder")}
          payees={payees}
          value={payeeId}
          onChange={onPayee}
        />
        {errors.payee_id !== undefined && (
          <FieldError>{errors.payee_id}</FieldError>
        )}
      </Field>
    </>
  );
}
