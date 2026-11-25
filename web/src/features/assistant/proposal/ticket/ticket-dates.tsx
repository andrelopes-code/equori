import styles from "@/features/assistant/proposal/ticket/ticket.module.css";
import { TicketDateStop } from "@/features/assistant/proposal/ticket/ticket-date-stop";
import type { TicketDate } from "@/features/assistant/proposal/ticket/ticket-dates-model";

interface TicketDatesProps {
  dates: readonly TicketDate[];
}

// The two dates of an operation, from edge to edge of the card.
export function TicketDates({ dates }: TicketDatesProps) {
  return (
    <ol className={styles.dates} data-part="dates">
      {dates.map((date) => (
        <TicketDateStop key={date.label} date={date} />
      ))}
    </ol>
  );
}
