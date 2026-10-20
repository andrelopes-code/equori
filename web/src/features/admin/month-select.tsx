import { parseISODate, stepMonth } from "@slotted/core/date";

import { RecordSelect } from "@/features/admin/record-select";
import { useToday } from "@/i18n/today";

// Slotted finding "No picker chooses a month": a statement reference is a year and a month,
// and date-picker chooses days only, so the months stand in a select from three years back
// to two years ahead.
function monthsAround(today: string): string[] {
  const start = parseISODate(`${today.slice(0, 7)}-01`);
  if (start === null) return [];
  const months: string[] = [];
  for (let step = -36; step <= 24; step++) {
    const { date } = stepMonth(start, step);
    months.push(`${String(date.year)}-${String(date.month).padStart(2, "0")}`);
  }
  return months.reverse();
}

export function MonthSelect({
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
  const months = monthsAround(useToday());
  return (
    <RecordSelect
      name={name}
      label={label}
      options={months.map((month) => ({ value: month, label: month }))}
      value={value}
      onChange={onChange}
    />
  );
}
