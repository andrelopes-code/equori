import { parseISODate, toISODate } from "@slotted/core/date";
import { DatePicker } from "@slotted/react/date-picker";
import { Stack } from "@slotted/react/stack";

import { DateShortcuts } from "@/ui/date-shortcuts";

// FM-16: a date in a form is a date-picker; the shortcuts beside it set the days most entries
// happened on with one press.
export function DateInput({
  name,
  value,
  onChange,
  shortcuts = true,
  min,
  max,
}: {
  name: string;
  value: string;
  onChange: (iso: string) => void;
  shortcuts?: boolean;
  min?: string | undefined;
  max?: string | undefined;
}) {
  const minValue = min === undefined ? null : parseISODate(min);
  const maxValue = max === undefined ? null : parseISODate(max);
  return (
    <Stack gap={2}>
      <DatePicker
        name={name}
        value={parseISODate(value)}
        {...(minValue === null ? {} : { min: minValue })}
        {...(maxValue === null ? {} : { max: maxValue })}
        onValueChange={(next) => {
          if (next !== null && !Array.isArray(next) && "year" in next) {
            onChange(toISODate(next));
          }
        }}
      />
      {shortcuts && <DateShortcuts value={value} onChange={onChange} />}
    </Stack>
  );
}
