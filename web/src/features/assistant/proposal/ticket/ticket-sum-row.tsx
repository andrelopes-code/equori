import styles from "@/features/assistant/proposal/ticket/ticket.module.css";
import { TicketValue } from "@/features/assistant/proposal/ticket/ticket-value";

interface TicketSumRowProps {
  label: string;
  text: string;
  was: string | undefined;
}

// One part of a ticket: its name at the start, its value at the end.
export function TicketSumRow({ label, text, was }: TicketSumRowProps) {
  return (
    <div className={styles.sumRow}>
      <dt className={styles.oneLine}>{label}</dt>
      <dd className={styles.num}>
        <TicketValue text={text} was={was} />
      </dd>
    </div>
  );
}
