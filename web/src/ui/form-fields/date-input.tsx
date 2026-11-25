import { parseISODate, toISODate } from "@slotted/core/date";
import { DatePicker, type DatePickerProps } from "@slotted/react/date-picker";

import { shiftDate } from "@/i18n/format";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";

interface DateInputProps {
  name: string;
  value: string;
  onChange: (iso: string) => void;
  shortcuts?: boolean;
  // An optional date: clearing the field reports the empty text.
  clearable?: boolean;
  min?: string | undefined;
  max?: string | undefined;
  // The trigger's name where no visible label names the field (a page header).
  messages?: DatePickerProps["messages"];
  className?: string | undefined;
}

// FM-16: a date in a form is a date-picker. With shortcuts, the days most entries happened on sit
// in the panel's shortcuts; the family adds Today before them.
export function DateInput({
  name,
  value,
  onChange,
  shortcuts = true,
  clearable = false,
  min,
  max,
  messages,
  className,
}: DateInputProps) {
  const t = useT();
  const today = useToday();

  const minValue = min === undefined ? null : parseISODate(min);
  const maxValue = max === undefined ? null : parseISODate(max);
  const presets = [
    { label: t("day.yesterday"), value: parseISODate(shiftDate(today, -1)) },
    {
      label: t("day.beforeYesterday"),
      value: parseISODate(shiftDate(today, -2)),
    },
  ];

  return (
    <DatePicker
      name={name}
      className={className}
      value={parseISODate(value)}
      {...(minValue === null ? {} : { min: minValue })}
      {...(maxValue === null ? {} : { max: maxValue })}
      messages={messages}
      clearable={clearable}
      presets={shortcuts ? presets : []}
      onValueChange={(next) => {
        if (next === null && clearable) onChange("");
        if (next !== null && !Array.isArray(next) && "year" in next) {
          onChange(toISODate(next));
        }
      }}
    />
  );
}
