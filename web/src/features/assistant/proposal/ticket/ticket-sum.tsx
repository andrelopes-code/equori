import styles from "@/features/assistant/proposal/ticket/ticket.module.css";
import type { TicketDate } from "@/features/assistant/proposal/ticket/ticket-dates-model";
import type { TicketNet } from "@/features/assistant/proposal/ticket/ticket-model";
import type { TicketRow } from "@/features/assistant/proposal/ticket/ticket-rows-model";
import { TicketSumNet } from "@/features/assistant/proposal/ticket/ticket-sum-net";
import { TicketSumPart } from "@/features/assistant/proposal/ticket/ticket-sum-part";
import { TicketSumRow } from "@/features/assistant/proposal/ticket/ticket-sum-row";
import { useTicketText } from "@/features/assistant/proposal/ticket/use-ticket-text";
import { useT } from "@/i18n/i18n-provider";

interface TicketSumProps {
  rows: readonly TicketRow[];
  net: TicketNet | undefined;
  // The single date of an operation that has one.
  date: TicketDate | undefined;
}

// The parts of the money, the net they add up to, and the single date of an operation.
export function TicketSum({ rows, net, date }: TicketSumProps) {
  const t = useT();
  const text = useTicketText();
  const was = date?.was === undefined ? undefined : text.date(date.was);

  if (rows.length === 0 && net === undefined && date === undefined) return null;

  return (
    <dl className={styles.sum}>
      {rows.map((row) => (
        <TicketSumPart key={row.label} row={row} />
      ))}

      {net !== undefined && <TicketSumNet net={net} />}

      {date !== undefined && (
        <TicketSumRow
          label={t(date.label)}
          text={text.date(date.date)}
          was={was}
        />
      )}
    </dl>
  );
}
