import { isPlainDate, parseISODate, toISODate } from "@slotted/core/date";
import { DatePicker } from "@slotted/react/date-picker";
import { Field, FieldLabel } from "@slotted/react/field";

export function DateEditor({
  name,
  label,
  value,
  onChange,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <DatePicker
        name={name}
        value={parseISODate(value)}
        onValueChange={(next) => {
          onChange(isPlainDate(next) ? toISODate(next) : "");
        }}
      />
    </Field>
  );
}
