export interface TradeDraft {
  side: "buy" | "sell";
  brokerageId: string | null;
  // The code of the investment; the server finds or creates its holding account (BC6).
  instrument: string | null;
  cashAccountId: string | null;
  date: string;
  // Units of the instrument, in its scale.
  quantity: number;
  // Null until typed: the stored price of the date stands in.
  unitPrice: string | null;
  // How the price is given: per unit, or as the total of an order filled at several prices.
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
