import {
  CalendarDayMark,
  CalendarDayMarks,
  CalendarDayValue,
} from "@slotted/react/calendar";

import type { CalendarDay } from "@/features/planning/agenda/month-days";
import { useMoneyFormat } from "@/privacy/use-money-format";

interface MonthGridDayProps {
  // Undefined while the month loads.
  day: CalendarDay | undefined;
  scale: (code: string) => number;
}

// What a day of the month holds under its number: the net, then a mark per occurrence.
export function MonthGridDay({ day, scale }: MonthGridDayProps) {
  const fmt = useMoneyFormat();

  if (day === undefined) return null;

  // The net as the cell can hold it: sign and whole units, no symbol, masked in privacy.
  const net =
    day.net === undefined
      ? ""
      : fmt
          .summary(day.net, scale(day.net.currency))
          .filter((s) => s.kind === "sign" || s.kind === "integer")
          .map((s) => s.text)
          .join("");

  return (
    <>
      <CalendarDayValue>{net}</CalendarDayValue>

      <CalendarDayMarks>
        {day.marks.map((mark, index) => (
          <CalendarDayMark
            key={index}
            tone={mark.direction === "in" ? "data-1" : "data-2"}
            hollow={mark.pending}
          />
        ))}
      </CalendarDayMarks>
    </>
  );
}
