import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@slotted/react/field";
import { TextField } from "@slotted/react/text-field";

import { useT } from "@/i18n/i18n-provider";

interface ReasonFieldProps {
  value: string;
  error: string | undefined;
  onChange: (reason: string) => void;
}

// The reason a correction keeps in the history of the transaction.
export function ReasonField({ value, error, onChange }: ReasonFieldProps) {
  const t = useT();

  return (
    <Field invalid={error !== undefined} required>
      <FieldLabel>{t("correct.reason")}</FieldLabel>
      <TextField
        name="reason"
        value={value}
        maxLength={500}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
      <FieldDescription>{t("correct.reasonHint")}</FieldDescription>
      {error !== undefined && <FieldError>{error}</FieldError>}
    </Field>
  );
}
