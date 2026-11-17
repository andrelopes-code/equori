import { Text } from "@slotted/react/typography";
import type { CSSProperties } from "react";

import { cyclePosition } from "@/features/cards/card-tile/statement-lead";
import styles from "@/features/cards/card-tile/statement-ticket.module.css";
import { cycleKeys } from "@/features/cards/card-tile/ticket-texts";
import { formatDayMonth } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface TicketCycleProps {
  closing: string;
  due: string;
  today: string;
  status: "danger" | "warning" | "info" | "neutral";
}

// The closing tick sits at 55 and the due tick at 92 of the track (spec 4.8).
const closingAt = 55;
const dueAt = 92;

// The billing cycle on one track: the closing, the due date and today.
export function TicketCycle({ closing, due, today, status }: TicketCycleProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const position = cyclePosition(closing, due, today);
  const keys = cycleKeys(closing, due, today);
  const closingDate = formatDayMonth(closing, locale);
  const dueDate = formatDayMonth(due, locale);
  const at = (value: number) =>
    ({ "--at": `${value.toFixed(1)}%` }) as CSSProperties;

  return (
    <div
      className={styles.cycle}
      role="img"
      aria-label={t("cards.ticket.cycle", {
        closing: closingDate,
        due: dueDate,
      })}
      data-status={status}
    >
      <span className={styles.cycleLine} aria-hidden="true" />
      <span className={styles.cycleLate} aria-hidden="true" />
      <span
        className={styles.cycleFill}
        style={at(position)}
        aria-hidden="true"
      />
      <span
        className={styles.cycleTick}
        style={at(closingAt)}
        data-passed={position >= closingAt || undefined}
        aria-hidden="true"
      />
      <span
        className={styles.cycleTick}
        style={at(dueAt)}
        data-passed={position >= dueAt || undefined}
        aria-hidden="true"
      />
      <span
        className={styles.cycleNow}
        style={at(position)}
        aria-hidden="true"
      />
      <span className={styles.cycleLabel} data-end="closing" aria-hidden="true">
        <Text size="xs" tone="muted" wrap="nowrap">
          {t(keys.closing, { date: closingDate })}
        </Text>
      </span>
      <span className={styles.cycleLabel} data-end="due" aria-hidden="true">
        <Text size="xs" tone="muted" wrap="nowrap">
          {t(keys.due, { date: dueDate })}
        </Text>
      </span>
    </div>
  );
}
