export interface NoteOrder {
  side: "buy" | "sell";
  // The code of the investment.
  instrument: string | null;
  // Units of the instrument, in its scale.
  quantity: number;
  // As typed; parsed when the note is sent.
  unitPrice: string;
}

export interface NoteDraft {
  brokerageId: string | null;
  cashAccountId: string | null;
  date: string;
  // Null until chosen: the settlement cycle of the exchange stands in (IO7).
  settlementDate: string | null;
  // Minor units of the base currency, for the whole note.
  fees: number;
  taxes: number;
  taxesCategoryId: string | null;
  description: string;
  orders: NoteOrder[];
}

export function emptyNote(
  date: string,
  brokerageId: string | null = null,
): NoteDraft {
  return {
    brokerageId,
    cashAccountId: null,
    date,
    settlementDate: null,
    fees: 0,
    taxes: 0,
    taxesCategoryId: null,
    description: "",
    orders: [emptyOrder()],
  };
}

export function emptyOrder(): NoteOrder {
  return { side: "buy", instrument: null, quantity: 0, unitPrice: "" };
}

export function isNoteDraft(value: unknown): value is NoteDraft {
  if (typeof value !== "object" || value === null) return false;
  const draft = value as Record<string, unknown>;
  return (
    typeof draft.date === "string" &&
    typeof draft.fees === "number" &&
    typeof draft.taxes === "number" &&
    typeof draft.description === "string" &&
    Array.isArray(draft.orders) &&
    "brokerageId" in draft
  );
}
