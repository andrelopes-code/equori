import { parseISOYearMonth, toISOYearMonth } from "@slotted/core/date";
import { DatePicker } from "@slotted/react/date-picker";
import { Field, FieldLabel } from "@slotted/react/field";

// A statement reference is a year and a month; the picker chooses one and submits YYYY-MM.
export function MonthEditor({
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
        granularity="month"
        name={name}
        value={parseISOYearMonth(value)}
        onValueChange={(next) => {
          onChange(next === null ? "" : toISOYearMonth(next));
        }}
      />
    </Field>
  );
}
