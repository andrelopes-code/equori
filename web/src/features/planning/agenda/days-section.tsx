import styles from "@/features/planning/agenda/agenda.module.css";
import { MonthCalendar } from "@/features/planning/agenda/month-calendar";
import type { DayMark } from "@/features/planning/agenda/month-close";

interface DaysSectionProps {
  month: string;
  marks: ReadonlyMap<string, DayMark>;
  onMonth: (month: string) => void;
  onDay: (iso: string) => void;
}

// The days of the month that hold occurrences (spec A5); the calendar's own title names the
// month, so the column draws no heading of its own.
export function DaysSection({
  month,
  marks,
  onMonth,
  onDay,
}: DaysSectionProps) {
  return (
    <div className={styles.days}>
      <MonthCalendar
        month={month}
        marks={marks}
        onMonth={onMonth}
        onDay={onDay}
      />
    </div>
  );
}
