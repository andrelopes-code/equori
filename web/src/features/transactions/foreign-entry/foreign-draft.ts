export interface ForeignDraft {
  cardId: string | null;
  date: string;
  payeeId: string | null;
  description: string;
  categoryId: string | null;
  // Minor units of the original currency.
  original: number;
  // A code from the currency list, or null; `otherCurrency` holds a code typed by hand and wins.
  currency: string | null;
  otherCurrency: string;
  // Text as typed; null while the person has not typed, which leaves the suggested price.
  rate: string | null;
  // Basis points as typed; null leaves the card's own rate.
  chargeBP: string | null;
  chargeCategoryId: string | null;
  statement: string | null;
}

export function emptyForeign(
  date: string,
  cardId: string | null = null,
): ForeignDraft {
  return {
    cardId,
    date,
    payeeId: null,
    description: "",
    categoryId: null,
    original: 0,
    currency: null,
    otherCurrency: "",
    rate: null,
    chargeBP: null,
    chargeCategoryId: null,
    statement: null,
  };
}

export function isForeignDraft(value: unknown): value is ForeignDraft {
  if (typeof value !== "object" || value === null) return false;
  const draft = value as Record<string, unknown>;
  return (
    typeof draft.date === "string" &&
    typeof draft.original === "number" &&
    typeof draft.description === "string" &&
    typeof draft.otherCurrency === "string" &&
    "chargeBP" in draft
  );
}
