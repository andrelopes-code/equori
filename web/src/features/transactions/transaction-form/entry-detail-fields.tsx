import { Field, FieldError, FieldLabel } from "@slotted/react/field";
import { TextField } from "@slotted/react/text-field";

import { TagsField } from "@/features/transactions/transaction-form/tags-field";
import { useT } from "@/i18n/i18n-provider";
import { FieldTitle } from "@/ui/form-fields/field-title";

export interface EntryDetailFieldsProps {
  description: string;
  value: readonly string[];
  tags: readonly string[];
  errors: Record<string, string>;
  onDescription: (description: string) => void;
  onTags: (tags: string[]) => void;
}

// The description and the tags, the same in every kind of entry.
export function EntryDetailFields({
  description,
  value,
  tags,
  errors,
  onDescription,
  onTags,
}: EntryDetailFieldsProps) {
  const t = useT();

  return (
    <>
      <Field invalid={errors.description !== undefined}>
        <FieldLabel>{t("facts.description")}</FieldLabel>
        <TextField
          name="description"
          value={description}
          maxLength={500}
          onChange={(event) => {
            onDescription(event.target.value);
          }}
        />
        {errors.description !== undefined && (
          <FieldError>{errors.description}</FieldError>
        )}
      </Field>

      <Field invalid={errors.tags !== undefined}>
        <FieldTitle label={t("facts.tags")} help={t("facts.tagsHelp")} />
        <TagsField
          placeholder={t("entry.tagsPlaceholder")}
          tags={tags}
          value={value}
          onChange={onTags}
        />
        {errors.tags !== undefined && <FieldError>{errors.tags}</FieldError>}
      </Field>
    </>
  );
}
