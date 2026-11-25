import styles from "@/features/assistant/proposal/ticket/ticket.module.css";
import type { TicketDate } from "@/features/assistant/proposal/ticket/ticket-dates-model";
import { useTicketText } from "@/features/assistant/proposal/ticket/use-ticket-text";
import { formatDayMonthNumeric } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface TicketDateStopProps {
  date: TicketDate;
}

const SEPARATOR = " · ";

// One date of two, with what moves on it; a corrected date names the one it replaces.
export function TicketDateStop({ date }: TicketDateStopProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const text = useTicketText();
  const moves = date.moves === undefined ? "" : t(date.moves);
  const detail =
    date.was === undefined
      ? moves
      : t("assistant.ticket.before", {
          date: formatDayMonthNumeric(date.was, locale),
        });

  return (
    <li className={styles.date}>
      <span className={styles.muted}>
        {[t(date.label), detail].join(SEPARATOR)}
      </span>
      <time className={styles.dateDay} dateTime={date.date}>
        {text.date(date.date)}
      </time>
    </li>
  );
}
