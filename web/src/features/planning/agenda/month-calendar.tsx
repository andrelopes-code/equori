import { parseISODate, toISODate, toISOYearMonth } from "@slotted/core/date";
import type { PlainDate } from "@slotted/core/date";
import { Calendar } from "@slotted/react/calendar";
import { useState } from "react";

import type { DayMark } from "@/features/planning/agenda/month-close";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface MonthCalendarProps {
  month: string;
  marks: ReadonlyMap<string, DayMark>;
  onMonth: (month: string) => void;
  onDay: (iso: string) => void;
}

// The month with a mark on each day that holds occurrences (spec A5). Paging the calendar
// moves the agenda's month; choosing a day reaches its first row.
export function MonthCalendar({
  month,
  marks,
  onMonth,
  onDay,
}: MonthCalendarProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const [focused, setFocused] = useState<PlainDate | null>(() =>
    parseISODate(`${month}-01`),
  );
  const [shownMonth, setShownMonth] = useState(month);
  const [day, setDay] = useState<PlainDate | null>(null);

  // The month control moves the calendar's month too.
  if (shownMonth !== month) {
    setShownMonth(month);
    setFocused(parseISODate(`${month}-01`));
  }

  return (
    <Calendar
      aria-label={t("agenda.calendar")}
      locale={locale}
      marks={marks}
      {...(focused === null ? {} : { focusedDate: focused })}
      onFocusedDateChange={(date) => {
        setFocused(date);
        const next = toISOYearMonth(date);
        if (next !== month) onMonth(next);
      }}
      value={day}
      onValueChange={(next) => {
        if (next === null || Array.isArray(next) || !("year" in next)) return;
        setDay(next);
        onDay(toISODate(next));
      }}
    />
  );
}
