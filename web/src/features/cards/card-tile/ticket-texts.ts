import type { StatementLeadResult } from "@/features/cards/card-tile/statement-lead";
import type { MessageKey } from "@/i18n/catalog.en";

export interface TicketKeys {
  name: MessageKey;
  word: MessageKey;
  // The time phrase beside the amount; it takes {when}.
  time: MessageKey | undefined;
}

// The catalog keys of the ticket's group name, status word and time phrase for a lead.
export function ticketKeys(lead: StatementLeadResult | undefined): TicketKeys {
  if (lead === undefined) {
    return {
      name: "cards.ticket.openName",
      word: "cards.ticket.word.none",
      time: undefined,
    };
  }

  if (lead.kind === "open") {
    return {
      name: "cards.ticket.openName",
      word: `cards.ticket.word.${lead.word}`,
      time: "cards.ticket.closes",
    };
  }

  return {
    name: "cards.stub.name",
    word: `cards.ticket.word.${lead.word}`,
    time: lead.days < 0 ? "cards.stub.overdue" : "cards.stub.due",
  };
}

// The labels of the cycle track: the closing and the due date, each in the past or the future.
export function cycleKeys(
  closing: string,
  due: string,
  today: string,
): { closing: MessageKey; due: MessageKey } {
  return {
    closing: today > closing ? "cards.ticket.closed" : "cards.ticket.closing",
    due: today > due ? "cards.ticket.wasDue" : "cards.ticket.dueOn",
  };
}
