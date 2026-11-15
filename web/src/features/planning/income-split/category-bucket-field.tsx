import { Field, FieldLabel } from "@slotted/react/field";

import type { components } from "@/api/schema.gen";
import {
  outsideChoice,
  sameChoice,
} from "@/features/planning/income-split/bucket-draft";
import { useT } from "@/i18n/i18n-provider";
import { ChoiceSelect } from "@/ui/form-fields/choice-select";

type Bucket = components["schemas"]["BudgetBucket"];

interface CategoryBucketFieldProps {
  method: readonly Bucket[];
  // A subcategory may follow its parent; a top-level category may stay outside.
  hasParent: boolean;
  value: string;
  onChange: (choice: string) => void;
}

// The bucket of the income split a category draws from (income buckets A229).
export function CategoryBucketField({
  method,
  hasParent,
  value,
  onChange,
}: CategoryBucketFieldProps) {
  const t = useT();
  const fallback = hasParent
    ? { value: sameChoice, label: t("buckets.option.parent") }
    : { value: outsideChoice, label: t("buckets.outside") };
  const choices = [
    fallback,
    ...method.map((b) => ({ value: b.id, label: b.name })),
  ];

  return (
    <Field>
      <FieldLabel>{t("buckets.field.bucket")}</FieldLabel>
      <ChoiceSelect
        label={t("buckets.field.bucket")}
        multiple={false}
        value={value}
        choices={choices}
        onChange={(next) => {
          if (typeof next === "string") onChange(next);
        }}
      />
    </Field>
  );
}
