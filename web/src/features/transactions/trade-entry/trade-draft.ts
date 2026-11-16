import { parseRate } from "@/features/instruments";
import type { NewTransactionSearch } from "@/features/transactions/model/search";

export interface TradeDraft {
  side: "buy" | "sell";
  brokerageId: string | null;
  // The code of the investment; the server finds or creates its holding account (BC6).
  instrument: string | null;
  cashAccountId: string | null;
  date: string;
  // Null until chosen: the settlement cycle of the exchange stands in (IO7).
  settlementDate: string | null;
  // Units of the instrument, in its scale.
  quantity: number;
  // The canonical decimal; null until typed, when the stored price of the date stands in.
  unitPrice: string | null;
  // The field edited last: the unit price, or the total of an order filled at several prices.
  priceBasis: "unit" | "total";
  // Minor units of the base currency; read only when the basis is total.
  total: number;
  // Minor units of the base currency.
  fees: number;
  taxes: number;
  taxesCategoryId: string | null;
  description: string;
}

export function emptyTrade(
  date: string,
  brokerageId: string | null = null,
): TradeDraft {
  return {
    side: "buy",
    brokerageId,
    instrument: null,
    cashAccountId: null,
    date,
    settlementDate: null,
    quantity: 0,
    unitPrice: null,
    priceBasis: "unit",
    total: 0,
    fees: 0,
    taxes: 0,
    taxesCategoryId: null,
    description: "",
  };
}

// The initial values a link of the entry route gives the fields of the form (FC20).
export function tradePreset(search: NewTransactionSearch): Partial<TradeDraft> {
  const { side, date, quantity, unit_price: unitPrice } = search;

  return {
    ...(side === undefined ? {} : { side }),
    ...(date === undefined ? {} : { date }),
    ...(quantity === undefined ? {} : { quantity }),
    ...(unitPrice === undefined ? {} : { unitPrice }),
  };
}

// A stored draft read back: fields added since it was stored take their empty value, and a unit
// price stored as typed in its language ("9,50") becomes the decimal the form now keeps.
export function storedTrade(stored: TradeDraft, today: string): TradeDraft {
  const start = { ...emptyTrade(today), ...stored };

  return {
    ...start,
    unitPrice: start.unitPrice === null ? null : parseRate(start.unitPrice),
  };
}

export function isTradeDraft(value: unknown): value is TradeDraft {
  if (typeof value !== "object" || value === null) return false;
  const draft = value as Record<string, unknown>;
  return (
    (draft.side === "buy" || draft.side === "sell") &&
    typeof draft.date === "string" &&
    typeof draft.quantity === "number" &&
    typeof draft.fees === "number" &&
    typeof draft.taxes === "number" &&
    typeof draft.description === "string" &&
    "brokerageId" in draft &&
    "instrument" in draft
  );
}
