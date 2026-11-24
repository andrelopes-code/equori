import { parseISODate, toISODate } from "@slotted/core/date";
import type { PlainDate } from "@slotted/core/date";
import { Calendar } from "@slotted/react/calendar";
import type { CalendarValue } from "@slotted/react/calendar";

import type { CalendarDay } from "@/features/planning/agenda/month-days";
import { MonthGridDay } from "@/features/planning/agenda/month-grid-day";
import { MonthGridLegend } from "@/features/planning/agenda/month-grid-legend";
import { MonthGridTip } from "@/features/planning/agenda/month-grid-tip";
import styles from "@/features/planning/agenda/month-grid.module.css";
import { monthEnd } from "@/features/planning/model/agenda";
import { formatDayMonthLong } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { useMoneyFormat } from "@/privacy/use-money-format";

interface MonthGridProps {
  // YYYY-MM.
  month: string;
  days: readonly CalendarDay[];
  firstDay: number;
  selected: string | null;
  scale: (code: string) => number;
  onDay: (iso: string) => void;
}

// The days of the month that move money, each with a mark per occurrence (filled once done, hollow
// while pending, by direction) and the day's net (spec A5). The page header's month control names
// and moves the month.
export function MonthGrid({
  month,
  days,
  firstDay,
  selected,
  scale,
  onDay,
}: MonthGridProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const today = useToday();
  const fmt = useMoneyFormat();

  const byDate = new Map(days.map((day) => [day.date, day]));
  const first = `${month}-01`;
  const dayOf = (date: PlainDate) => byDate.get(toISODate(date));
  const busy = (day: CalendarDay | undefined) =>
    day?.inMonth === true && day.rows.length > 0;

  function describe(date: PlainDate) {
    const rows = dayOf(date)?.rows ?? [];

    return [
      formatDayMonthLong(toISODate(date), locale),
      ...rows.map(
        (r) =>
          `${r.schedule?.description ?? t("ledger.untitled")} ${fmt.signed(r.money, scale(r.money.currency))}, ${t(`occurrence.state.${r.occurrence.state}`)}`,
      ),
    ].join("; ");
  }

  function handleValue(next: CalendarValue) {
    // The calendar clears the day chosen again; the list scrolls to it again.
    const iso = next !== null && "year" in next ? toISODate(next) : selected;
    if (iso !== null) onDay(iso);
  }

  return (
    <div className={styles.root} role="group" aria-label={t("agenda.calendar")}>
      <Calendar
        key={month}
        className={styles.calendar}
        header={false}
        layout="fill"
        lines
        dayAlign="start"
        todayMark="disc"
        locale={locale}
        firstDayOfWeek={firstDay}
        defaultFocusedDate={
          parseISODate(today.startsWith(month) ? today : first) ?? undefined
        }
        min={parseISODate(first) ?? undefined}
        max={parseISODate(monthEnd(month)) ?? undefined}
        value={selected === null ? null : parseISODate(selected)}
        onValueChange={handleValue}
        isDateInert={(date) => !busy(dayOf(date))}
        dayLabel={describe}
        renderDay={(date) => <MonthGridDay day={dayOf(date)} scale={scale} />}
        renderDayTooltip={(date) => (
          <MonthGridTip rows={dayOf(date)?.rows ?? []} scale={scale} />
        )}
      />

      <MonthGridLegend />
    </div>
  );
}
