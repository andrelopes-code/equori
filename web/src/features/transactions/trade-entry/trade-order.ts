import type { components } from "@/api/schema.gen";
import type { TradeDraft } from "@/features/transactions/trade-entry/trade-draft";

type TradeInput = components["schemas"]["TradeInput"];

export interface TradeOrderParts {
  brokerageId: string;
  instrument: string;
  // The paying or receiving account and the unit price; absent on a write-off.
  cashAccountId: string | undefined;
  rate: string | null;
  // The cash currency: the base, or the quote currency of the instrument (FC1).
  currency: string;
  // Null for cash in the base currency and when the rate of the day stands in.
  exchangeRate: string | null;
  taxes: number;
}

// The request of the trade form. A write-off sends the holding, the date and the quantity, no
// cash, price or charges (listed options design W1). An opening sends no cash account,
// settlement date or taxes (investment history OL1).
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

  const { currency, taxes } = parts;
  const opening = draft.side === "opening";

  return {
    ...target,
    ...(parts.cashAccountId === undefined || opening
      ? {}
      : { cash_account_id: parts.cashAccountId }),
    ...(draft.settlementDate === null || opening
      ? {}
      : { settlement_date: draft.settlementDate }),
    ...(parts.rate === null ? {} : { unit_price: parts.rate }),
    ...(parts.exchangeRate === null
      ? {}
      : { exchange_rate: parts.exchangeRate }),
    ...(draft.fees > 0 ? { fees: { amount: draft.fees, currency } } : {}),
    ...(taxes > 0 && !opening ? { taxes: { amount: taxes, currency } } : {}),
    ...(taxes > 0 && !opening && draft.taxesCategoryId !== null
      ? { taxes_category_id: draft.taxesCategoryId }
      : {}),
    ...described,
  };
}
