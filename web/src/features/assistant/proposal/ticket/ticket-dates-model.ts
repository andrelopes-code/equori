import type { components } from "@/api/schema.gen";
import { changeOf } from "@/features/assistant/proposal/preview-field";
import type { MessageKey } from "@/i18n/catalog.en";

type Preview = components["schemas"]["AssistantPreview"];
type Change = Preview["changes"][number];

export interface TicketDate {
  label: MessageKey;
  date: string;
  was?: string;
  // What moves on the date, when the operation has two.
  moves?: MessageKey;
}

const SINGLE = new Map<string, MessageKey>(
  Object.entries({
    income: "assistant.ticket.date.payment",
    write_off: "assistant.ticket.date.write_off",
    unit_tax: "assistant.ticket.date.cancelled",
    transfer_custody: "assistant.ticket.date.arrival",
    record_fixed_income: "assistant.ticket.date.application",
    opening: "assistant.ticket.date.opening",
    buy: "assistant.ticket.date.trade",
    sell: "assistant.ticket.date.trade",
    note: "assistant.ticket.date.trade",
  } satisfies Record<string, MessageKey>),
);

// The dates of an operation: the trade and its settlement, the application and its maturity, or the
// single date of any other (investment proposals design, IP13).
export function ticketDates(preview: Preview, kind: string): TicketDate[] {
  const date = changeOf(preview, "date");
  if (date?.after?.date === undefined) return [];

  const label = SINGLE.get(kind) ?? "assistant.ticket.date.ex";
  const first = dateOf(date, label);
  const settlement = changeOf(preview, "settlement");
  const maturity = changeOf(preview, "maturity");

  if (maturity !== undefined) {
    return [
      { ...first, moves: "assistant.ticket.moves.money" },
      {
        ...dateOf(maturity, "assistant.ticket.date.maturity"),
        moves: "assistant.ticket.moves.contract",
      },
    ];
  }

  if (settlement === undefined) return [first];

  if (settlement.after?.date === first.date) {
    return [{ ...first, label: "assistant.ticket.date.same" }];
  }

  return [
    {
      ...first,
      moves:
        kind === "note"
          ? "assistant.ticket.moves.holdings"
          : "assistant.ticket.moves.holding",
    },
    {
      ...dateOf(settlement, "assistant.ticket.date.settlement"),
      moves: "assistant.ticket.moves.money",
    },
  ];
}

function dateOf(change: Change, label: MessageKey): TicketDate {
  const was = change.before?.date;

  return {
    label,
    date: change.after?.date ?? "",
    ...(was !== undefined && { was }),
  };
}
