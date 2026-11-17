import { Field, FieldError, FieldLabel } from "@slotted/react/field";

import { useT } from "@/i18n/i18n-provider";
import { DateInput } from "@/ui/form-fields/date-input";

export interface EntryDateFieldProps {
  value: string;
  error: string | undefined;
  onChange: (date: string) => void;
}

// The date of an entry.
export function EntryDateField({
  value,
  error,
  onChange,
}: EntryDateFieldProps) {
  const t = useT();

  return (
    <Field required invalid={error !== undefined}>
      <FieldLabel>{t("entry.date")}</FieldLabel>
      <DateInput name="date" value={value} onChange={onChange} />
      {error !== undefined && <FieldError>{error}</FieldError>}
    </Field>
  );
}
