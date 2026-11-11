import { Field, FieldDescription, FieldLabel } from "@slotted/react/field";
import { TextField } from "@slotted/react/text-field";

// A whole number typed as written: months, days, installments, years. unit names it after the
// digits.
export function CountField({
  label,
  hint,
  unit,
  name,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  unit?: string;
  name: string;
  value: string;
  onChange: (text: string) => void;
}) {
  return (
    <Field necessity="none">
      <FieldLabel>{label}</FieldLabel>
      <TextField
        name={name}
        inputMode="numeric"
        autoComplete="off"
        value={value}
        {...(unit === undefined ? {} : { end: unit })}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
      {hint !== undefined && <FieldDescription>{hint}</FieldDescription>}
    </Field>
  );
}
