import { useRef } from "react";

import { parseISODate, toISODate } from "@slotted/core/date";
import {
  DatePicker,
  type DatePickerHandle,
  type DatePickerProps,
} from "@slotted/react/date-picker";

import { DateShortcuts } from "@/ui/date-shortcuts";

interface DateInputProps {
  name: string;
  value: string;
  onChange: (iso: string) => void;
  shortcuts?: boolean;
  min?: string | undefined;
  max?: string | undefined;
  // The trigger's name where no visible label names the field (a page header).
  messages?: DatePickerProps["messages"];
  className?: string | undefined;
}

// FM-16: a date in a form is a date-picker. With shortcuts, the days most entries happened on sit
// in the calendar's presets column.
export function DateInput({
  name,
  value,
  onChange,
  shortcuts = true,
  min,
  max,
  messages,
  className,
}: DateInputProps) {
  const picker = useRef<DatePickerHandle>(null);

  const minValue = min === undefined ? null : parseISODate(min);
  const maxValue = max === undefined ? null : parseISODate(max);

  function handleChoose(iso: string) {
    onChange(iso);
    picker.current?.close();
  }

  return (
    <DatePicker
      ref={picker}
      name={name}
      className={className}
      value={parseISODate(value)}
      {...(minValue === null ? {} : { min: minValue })}
      {...(maxValue === null ? {} : { max: maxValue })}
      messages={messages}
      {...(shortcuts
        ? { presets: <DateShortcuts value={value} onChoose={handleChoose} /> }
        : {})}
      onValueChange={(next) => {
        if (next !== null && !Array.isArray(next) && "year" in next) {
          onChange(toISODate(next));
        }
      }}
    />
  );
}
