import { Text } from "@slotted/react/typography";
import {
  Tooltip,
  TooltipContent,
  TooltipLayer,
  TooltipTrigger,
} from "@slotted/react/tooltip";

import type { CalendarDay } from "@/features/planning/agenda/month-days";
import styles from "@/features/planning/agenda/month-grid.module.css";
import { formatDayMonthLong, weekdayLabels } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

interface MonthGridProps {
  days: readonly CalendarDay[];
  firstDay: number;
  today: string;
  selected: string | null;
  scale: (code: string) => number;
  onDay: (iso: string) => void;
}

// The month as a grid of days, each with a mark per occurrence (filled once done, hollow while
// pending, by direction) and the day's net (spec A5).
// Families read: calendar (one dot of one tone per day, no content inside a day: no direction,
// no done and pending apart, no amount; a fixed cell size), event-calendar (event chips of a
// schedule app, no net per day).
// Workaround for Slotted issue #111: the calendar takes no content inside a day cell, so the app
// draws its own month grid.
export function MonthGrid({
  days,
  firstDay,
  today,
  selected,
  scale,
  onDay,
}: MonthGridProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();

  // The day's net as the cell can hold it: sign and whole units, no symbol, masked in privacy.
  const short = (day: CalendarDay) =>
    day.net === undefined
      ? ""
      : fmt
          .summary(day.net, scale(day.net.currency))
          .filter((s) => s.kind === "sign" || s.kind === "integer")
          .map((s) => s.text)
          .join("");
  const describe = (day: CalendarDay) =>
    [
      formatDayMonthLong(day.date, locale),
      ...day.rows.map(
        (r) =>
          `${r.schedule?.description ?? t("ledger.untitled")} ${fmt.signed(r.money, scale(r.money.currency))}, ${t(`occurrence.state.${r.occurrence.state}`)}`,
      ),
    ].join("; ");

  return (
    <div className={styles.root}>
      <div className={styles.weekdays} aria-hidden="true">
        {weekdayLabels(locale, firstDay).map((label) => (
          <span key={label} className={styles.weekday}>
            {label}
          </span>
        ))}
      </div>
      <div
        className={styles.grid}
        role="group"
        aria-label={t("agenda.calendar")}
      >
        {days.map((day) => {
          const body = (
            <>
              <span className={styles.number}>{Number(day.date.slice(8))}</span>
              <span className={styles.net} aria-hidden="true">
                {short(day)}
              </span>
              <span className={styles.marks} aria-hidden="true">
                {day.marks.map((mark, index) => (
                  <i
                    key={index}
                    className={styles.mark}
                    data-direction={mark.direction}
                    data-pending={mark.pending ? "" : undefined}
                  />
                ))}
              </span>
            </>
          );
          const state = {
            "data-outside": day.inMonth ? undefined : "",
            "data-today": day.date === today ? "" : undefined,
            "data-selected": day.date === selected ? "" : undefined,
          };
          if (!day.inMonth || day.rows.length === 0)
            return (
              <span
                key={day.date}
                className={styles.day}
                {...state}
                aria-hidden="true"
              >
                {body}
              </span>
            );

          return (
            <Tooltip key={day.date}>
              <TooltipTrigger
                render={(props) => (
                  <button
                    {...props}
                    type="button"
                    className={styles.day}
                    {...state}
                    data-busy=""
                    aria-label={describe(day)}
                    aria-pressed={day.date === selected}
                    onClick={() => {
                      onDay(day.date);
                    }}
                  >
                    {body}
                  </button>
                )}
              />
              <TooltipLayer>
                <TooltipContent>
                  {day.rows.map((r) => (
                    <span key={r.occurrence.id} className={styles.tipRow}>
                      <Text size="xs">
                        {r.schedule?.description ?? t("ledger.untitled")}
                      </Text>
                      <Text size="xs" numeric="tabular">
                        {fmt.signed(r.money, scale(r.money.currency))}
                      </Text>
                    </span>
                  ))}
                </TooltipContent>
              </TooltipLayer>
            </Tooltip>
          );
        })}
      </div>

      <div className={styles.legend} aria-hidden="true">
        <span className={styles.key}>
          <i className={styles.mark} data-direction="in" />
          <Text size="xs" tone="muted">
            {t("agenda.legendIn")}
          </Text>
        </span>
        <span className={styles.key}>
          <i className={styles.mark} data-direction="out" />
          <Text size="xs" tone="muted">
            {t("agenda.legendOut")}
          </Text>
        </span>
        <span className={styles.key}>
          <i className={styles.mark} data-direction="out" data-pending="" />
          <Text size="xs" tone="muted">
            {t("agenda.legendPending")}
          </Text>
        </span>
      </div>
    </div>
  );
}
