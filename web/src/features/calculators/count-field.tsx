import { Field, FieldLabel } from "@slotted/react/field";
import { TextField } from "@slotted/react/text-field";

// A whole number typed as written: months, days, installments, years.
export function CountField({
  label,
  name,
  value,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (text: string) => void;
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <TextField
        name={name}
        inputMode="numeric"
        autoComplete="off"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
    </Field>
  );
}
