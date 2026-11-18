import type { components } from "@/api/schema.gen";
import type { TradeDraft } from "@/features/transactions/trade-entry/trade-draft";

type TradeInput = components["schemas"]["TradeInput"];

export interface TradeOrderParts {
  brokerageId: string;
  instrument: string;
  // The paying or receiving account and the unit price; absent on a write-off.
  cashAccountId: string | undefined;
  rate: string | null;
  base: string;
  taxes: number;
}

// The request of the trade form. A write-off sends the holding, the date and the quantity, no
// cash, price or charges (listed options design W1).
export function tradeOrder(
  draft: TradeDraft,
  parts: TradeOrderParts,
): TradeInput {
  const description = draft.description.trim();
  const described = description === "" ? {} : { description };
  const target = {
    brokerage_id: parts.brokerageId,
    instrument: parts.instrument,
    side: draft.side,
    date: draft.date,
    quantity: { amount: draft.quantity, currency: parts.instrument },
  };

  if (draft.side === "write_off") return { ...target, ...described };

  const { base, taxes } = parts;

  return {
    ...target,
    ...(parts.cashAccountId === undefined
      ? {}
      : { cash_account_id: parts.cashAccountId }),
    ...(draft.settlementDate === null
      ? {}
      : { settlement_date: draft.settlementDate }),
    ...(parts.rate === null ? {} : { unit_price: parts.rate }),
    ...(draft.fees > 0 ? { fees: { amount: draft.fees, currency: base } } : {}),
    ...(taxes > 0 ? { taxes: { amount: taxes, currency: base } } : {}),
    ...(taxes > 0 && draft.taxesCategoryId !== null
      ? { taxes_category_id: draft.taxesCategoryId }
      : {}),
    ...described,
  };
}
