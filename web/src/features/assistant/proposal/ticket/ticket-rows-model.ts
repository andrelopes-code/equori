import type { components } from "@/api/schema.gen";
import { changeOf } from "@/features/assistant/proposal/preview-field";
import {
  absolute,
  sumOf,
} from "@/features/assistant/proposal/ticket/ticket-money";
import type { MessageKey } from "@/i18n/catalog.en";

type Preview = components["schemas"]["AssistantPreview"];
type Value = components["schemas"]["AssistantValue"];

export interface TicketRow {
  label: MessageKey;
  value?: Value;
  was?: Value;
  // A fact in words, in place of a value.
  words?: MessageKey;
  // The part leaves a net that enters.
  minus: boolean;
}

const COST_STAYS = ["split", "reverse_split"];
const COSTS = ["fees", "taxes", "withheld"] as const;

// The parts that add up to the net, then the facts of an operation that moves no money.
export function ticketRows(preview: Preview, kind: string): TicketRow[] {
  if (kind === "transfer_custody") return custodyRows(preview);

  const enters =
    kind === "sell" || kind === "income" || hasSide(preview, "sell");
  const costs = COSTS.flatMap((field) => {
    const row = changeRow(preview, field, `assistant.field.${field}`);

    return row === undefined
      ? []
      : [{ ...row, minus: enters && !isZero(row.value) }];
  });
  const totals =
    kind === "note" ? noteTotals(preview) : grossRow(preview, kind);
  const [total, ...others] = totals;
  // A single total that is the net, with no cost beside it, says the net twice.
  const repeated =
    total !== undefined &&
    others.length === 0 &&
    costs.length === 0 &&
    isNet(preview, total.value);

  return [...(repeated ? [] : totals), ...costs, ...factRows(preview, kind)];
}

function custodyRows(preview: Preview): TicketRow[] {
  const account = changeOf(preview, "account");

  return [
    {
      label: "assistant.ticket.from",
      value: account?.before ?? {},
      minus: false,
    },
    { label: "assistant.ticket.to", value: account?.after ?? {}, minus: false },
    {
      label: "assistant.ticket.cost",
      words: "assistant.ticket.cost.follows",
      minus: false,
    },
  ];
}

// The totals of the orders by side.
function noteTotals(preview: Preview): TicketRow[] {
  const total = (side: string) =>
    sumOf(
      (preview.items ?? [])
        .filter((item) => item.side === side)
        .map((item) => item.amount ?? {}),
    );
  const sales = total("sell");
  const purchases = total("buy");

  return [
    ...(sales === undefined
      ? []
      : [
          {
            label: "assistant.ticket.sales" as const,
            value: sales,
            minus: false,
          },
        ]),
    ...(purchases === undefined
      ? []
      : [
          {
            label: "assistant.ticket.purchases" as const,
            value: purchases,
            minus: sales !== undefined,
          },
        ]),
  ];
}

function grossRow(preview: Preview, kind: string): TicketRow[] {
  const label =
    kind === "unit_tax" ? "assistant.field.taxes" : "assistant.ticket.gross";
  const row = changeRow(preview, "amount", label);

  return row === undefined ? [] : [row];
}

// What an operation without money changes or keeps.
function factRows(preview: Preview, kind: string): TicketRow[] {
  const rows: (TicketRow | undefined)[] = [];

  if (kind === "bonus")
    rows.push(changeRow(preview, "price", "assistant.ticket.unit_cost"));

  if (kind === "spin_off")
    rows.push(changeRow(preview, "rate", "assistant.ticket.cost_moved"));

  if (kind === "write_off")
    rows.push({
      label: "assistant.ticket.received",
      words: "assistant.ticket.received.none",
      minus: false,
    });

  if (COST_STAYS.includes(kind))
    rows.push({
      label: "assistant.ticket.cost_total",
      words: "assistant.ticket.cost.stays",
      minus: false,
    });

  return rows.filter((row) => row !== undefined);
}

function changeRow(
  preview: Preview,
  field: string,
  label: MessageKey,
): TicketRow | undefined {
  const change = changeOf(preview, field);
  if (change?.after === undefined) return undefined;

  return {
    label,
    value: change.after,
    ...(change.before !== undefined && { was: change.before }),
    minus: false,
  };
}

function isNet(preview: Preview, value: Value | undefined): boolean {
  const net = changeOf(preview, "net")?.after;

  return net !== undefined && absolute(net).amount === value?.amount;
}

function isZero(value: Value | undefined): boolean {
  return value?.amount !== undefined && Number(value.amount) === 0;
}

function hasSide(preview: Preview, side: string): boolean {
  return (preview.items ?? []).some((item) => item.side === side);
}
