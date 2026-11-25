import type { components } from "@/api/schema.gen";
import {
  changeOf,
  changesWithout,
} from "@/features/assistant/proposal/preview-field";
import { operationKind } from "@/features/assistant/proposal/ticket/operation-kind";
import { ticketDates } from "@/features/assistant/proposal/ticket/ticket-dates-model";
import type { TicketDate } from "@/features/assistant/proposal/ticket/ticket-dates-model";
import {
  absolute,
  leaves,
} from "@/features/assistant/proposal/ticket/ticket-money";
import { ticketHero } from "@/features/assistant/proposal/ticket/ticket-hero-model";
import type { TicketHeroData } from "@/features/assistant/proposal/ticket/ticket-hero-model";
import { ticketRows } from "@/features/assistant/proposal/ticket/ticket-rows-model";
import type { TicketRow } from "@/features/assistant/proposal/ticket/ticket-rows-model";

type Preview = components["schemas"]["AssistantPreview"];
type Change = Preview["changes"][number];
type Item = components["schemas"]["AssistantPreviewItem"];
type Value = components["schemas"]["AssistantValue"];

export interface TicketNet {
  // The amount without its sign: the direction is in leaves.
  value: Value;
  leaves: boolean;
  account?: string;
}

export interface Ticket {
  hero: TicketHeroData | undefined;
  // The orders of a note with more than one.
  orders: readonly Item[];
  rows: TicketRow[];
  net: TicketNet | undefined;
  dates: TicketDate[];
  reason: string | undefined;
  // The changes the ticket has no place for.
  rest: Change[];
}

const PLACED = [
  "account",
  "amount",
  "date",
  "fees",
  "income_type",
  "index",
  "institution",
  "instrument",
  "kind",
  "maturity",
  "net",
  "price",
  "quantity",
  "rate",
  "ratio",
  "reason",
  "settlement",
  "spread",
  "taxes",
  "withheld",
];

// An investment proposal as a ticket: the operation, the money, the dates (investment proposals
// design, IP11).
export function ticketOf(preview: Preview): Ticket {
  const { action } = preview;
  const kind = operationKind(preview);
  const items = preview.items ?? [];
  const shown = withSingleOrder(preview);

  return {
    hero: kind === "note" ? undefined : ticketHero(shown, kind),
    orders: kind === "note" ? items : [],
    rows: ticketRows(shown, kind),
    net: netOf(shown),
    dates: ticketDates(shown, action === "record_fixed_income" ? action : kind),
    reason: changeOf(shown, "reason")?.after?.text,
    rest: changesWithout(shown, PLACED),
  };
}

// A note with one order carries the fields of that order as a trade does.
function withSingleOrder(preview: Preview): Preview {
  const [order, ...others] = preview.items ?? [];
  const single =
    preview.action === "record_brokerage_note" && others.length === 0;
  if (!single || order === undefined) return preview;

  return {
    ...preview,
    changes: [
      { field: "instrument", after: { text: order.description } },
      { field: "quantity", after: order.quantity ?? {} },
      { field: "price", after: order.price ?? {} },
      { field: "amount", after: order.amount ?? {} },
      ...preview.changes,
    ],
  };
}

function netOf(preview: Preview): TicketNet | undefined {
  const net = changeOf(preview, "net");
  if (net?.after === undefined) return undefined;

  const account = changeOf(preview, "account")?.after?.text;

  return {
    value: absolute(net.after),
    leaves: leaves(net.after),
    ...(account !== undefined && { account }),
  };
}
