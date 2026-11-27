import type { components } from "@/api/schema.gen";
import { parseRate } from "@/features/instruments";
import { grossOf } from "@/features/transactions/entry-model/trade-math";
import type {
  NoteDraft,
  NoteOrder,
} from "@/features/transactions/note-entry/note-draft";
import type { MessageKey } from "@/i18n/catalog.en";

type BrokerageNoteInput = components["schemas"]["BrokerageNoteInput"];
type BrokerageNoteOrder = components["schemas"]["BrokerageNoteOrder"];

// The gross of each order in minor units of the cash currency; null while the order lacks an
// investment, a quantity or a price.
export function orderGrosses(
  orders: readonly NoteOrder[],
  scale: (code: string) => number,
  cashScale: number,
): (number | null)[] {
  return orders.map((order) => {
    const rate = parseRate(order.unitPrice);
    if (order.instrument === null || rate === null || order.quantity <= 0) {
      return null;
    }
    return grossOf(order.quantity, scale(order.instrument), rate, cashScale);
  });
}

// The fields the note cannot be sent without, keyed as the server keys its own refusals.
export function noteProblems(
  draft: NoteDraft,
  chosen: { brokerage: boolean; payer: boolean },
): Record<string, MessageKey> {
  const problems: Record<string, MessageKey> = {};
  if (!chosen.brokerage) problems.brokerage_id = "entry.required.account";
  if (!chosen.payer) problems.cash_account_id = "trade.required.cashAccount";
  if (draft.orders.length === 0) problems.orders = "note.required.orders";

  draft.orders.forEach((order, index) => {
    const prefix = `orders[${String(index)}]`;
    if (order.instrument === null) {
      problems[`${prefix}.instrument`] = "trade.required.securityAccount";
    }
    if (order.quantity <= 0) {
      problems[`${prefix}.quantity`] = "trade.required.quantity";
    }
    if (parseRate(order.unitPrice) === null) {
      problems[`${prefix}.unit_price`] = "trade.required.price";
    }
  });

  return problems;
}

export function noteBody(
  draft: NoteDraft,
  ids: { brokerage: string; payer: string },
  // The cash currency and the rate typed for it; null rate for cash in the base currency.
  cash: { currency: string; exchangeRate: string | null },
): BrokerageNoteInput {
  const description = draft.description.trim();
  const taxes = draft.orders.some((o) => o.side === "sell") ? draft.taxes : 0;

  return {
    brokerage_id: ids.brokerage,
    cash_account_id: ids.payer,
    date: draft.date,
    ...(draft.settlementDate === null
      ? {}
      : { settlement_date: draft.settlementDate }),
    ...(cash.exchangeRate === null ? {} : { exchange_rate: cash.exchangeRate }),
    ...(draft.fees > 0
      ? { fees: { amount: draft.fees, currency: cash.currency } }
      : {}),
    ...(taxes > 0 ? { taxes: { amount: taxes, currency: cash.currency } } : {}),
    ...(taxes > 0 && draft.taxesCategoryId !== null
      ? { taxes_category_id: draft.taxesCategoryId }
      : {}),
    ...(description === "" ? {} : { description }),
    orders: draft.orders.flatMap(orderInput),
  };
}

function orderInput(order: NoteOrder): BrokerageNoteOrder[] {
  const rate = parseRate(order.unitPrice);
  if (order.instrument === null || rate === null) return [];

  return [
    {
      side: order.side,
      instrument: order.instrument,
      quantity: { amount: order.quantity, currency: order.instrument },
      unit_price: rate,
    },
  ];
}
