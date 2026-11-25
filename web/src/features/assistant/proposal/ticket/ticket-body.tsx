import type { components } from "@/api/schema.gen";
import { ProposalChanges } from "@/features/assistant/proposal/proposal-changes";
import styles from "@/features/assistant/proposal/ticket/ticket.module.css";
import { TicketDates } from "@/features/assistant/proposal/ticket/ticket-dates";
import { TicketHero } from "@/features/assistant/proposal/ticket/ticket-hero";
import { ticketOf } from "@/features/assistant/proposal/ticket/ticket-model";
import { TicketOrders } from "@/features/assistant/proposal/ticket/ticket-orders";
import { TicketSum } from "@/features/assistant/proposal/ticket/ticket-sum";
import { useT } from "@/i18n/i18n-provider";

type Preview = components["schemas"]["AssistantPreview"];

interface TicketBodyProps {
  preview: Preview;
}

// An investment proposal as a ticket: the operation, the money, the dates (investment proposals
// design, IP11).
export function TicketBody({ preview }: TicketBodyProps) {
  const t = useT();
  const ticket = ticketOf(preview);
  const [first, second] = ticket.dates;

  return (
    <div className={styles.ticket}>
      {ticket.hero !== undefined && <TicketHero hero={ticket.hero} />}

      {ticket.orders.length > 0 && <TicketOrders orders={ticket.orders} />}

      <TicketSum
        rows={ticket.rows}
        net={ticket.net}
        date={second === undefined ? first : undefined}
      />

      {second !== undefined && <TicketDates dates={ticket.dates} />}

      <ProposalChanges changes={ticket.rest} />

      {ticket.reason !== undefined && (
        <p className={styles.reason}>
          {t("assistant.ticket.reason", { reason: ticket.reason })}
        </p>
      )}
    </div>
  );
}
