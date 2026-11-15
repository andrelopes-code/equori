import type { CalendarDay } from "@/features/planning/agenda/month-days";
import { MonthGrid } from "@/features/planning/agenda/month-grid";
import { useToday } from "@/i18n/today";

interface DaysSectionProps {
  days: readonly CalendarDay[];
  firstDay: number;
  selected: string | null;
  scale: (code: string) => number;
  onDay: (iso: string) => void;
}

// The days of the month that move money (spec A5); the page header's month control names and
// moves the month.
export function DaysSection({
  days,
  firstDay,
  selected,
  scale,
  onDay,
}: DaysSectionProps) {
  const today = useToday();

  return (
    <MonthGrid
      days={days}
      firstDay={firstDay}
      today={today}
      selected={selected}
      scale={scale}
      onDay={onDay}
    />
  );
}
