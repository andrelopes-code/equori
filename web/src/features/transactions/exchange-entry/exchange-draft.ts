export interface ExchangeDraft {
  fromId: string | null;
  toId: string | null;
  date: string;
  description: string;
  // Minor units of the currency of each account.
  fromAmount: number;
  toAmount: number;
  // Minor units of the base currency.
  fee: number;
  feeCategoryId: string | null;
}

export function emptyExchange(
  date: string,
  fromId: string | null = null,
): ExchangeDraft {
  return {
    fromId,
    toId: null,
    date,
    description: "",
    fromAmount: 0,
    toAmount: 0,
    fee: 0,
    feeCategoryId: null,
  };
}

export function isExchangeDraft(value: unknown): value is ExchangeDraft {
  if (typeof value !== "object" || value === null) return false;
  const draft = value as Record<string, unknown>;
  return (
    typeof draft.date === "string" &&
    typeof draft.fromAmount === "number" &&
    typeof draft.toAmount === "number" &&
    typeof draft.fee === "number" &&
    "feeCategoryId" in draft
  );
}
