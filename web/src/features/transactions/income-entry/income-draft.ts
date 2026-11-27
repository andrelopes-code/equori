import type { NewTransactionSearch } from "@/features/transactions/model/search";

export interface IncomeDraft {
  brokerageId: string | null;
  instrument: string | null;
  cashAccountId: string | null;
  date: string;
  incomeType: string | null;
  // Minor units of the cash currency.
  gross: number;
  withheld: number;
  categoryId: string | null;
  withheldCategoryId: string | null;
  // The canonical decimal of base currency per unit of the cash currency, for cash in the quote
  // currency (FC2); null takes the rate of the day.
  exchangeRate?: string | null;
  description: string;
}

export function emptyIncome(
  date: string,
  brokerageId: string | null = null,
): IncomeDraft {
  return {
    brokerageId,
    instrument: null,
    cashAccountId: null,
    date,
    incomeType: null,
    gross: 0,
    withheld: 0,
    categoryId: null,
    withheldCategoryId: null,
    exchangeRate: null,
    description: "",
  };
}

// The initial values a link of the entry route gives the fields of the form (FC20). The account of
// the route stands over the holding a stored draft names (IE6).
export function incomePreset(
  accountId: string | null,
  search: NewTransactionSearch,
): Partial<IncomeDraft> {
  const { income_type: incomeType, gross, date } = search;

  return {
    ...(accountId === null
      ? {}
      : { brokerageId: null, instrument: null, cashAccountId: null }),
    ...(incomeType === undefined ? {} : { incomeType }),
    ...(gross === undefined ? {} : { gross }),
    ...(date === undefined ? {} : { date }),
  };
}

export function isIncomeDraft(value: unknown): value is IncomeDraft {
  if (typeof value !== "object" || value === null) return false;
  const draft = value as Record<string, unknown>;
  return (
    typeof draft.date === "string" &&
    typeof draft.gross === "number" &&
    typeof draft.withheld === "number" &&
    typeof draft.description === "string" &&
    "incomeType" in draft &&
    "brokerageId" in draft &&
    "instrument" in draft
  );
}
