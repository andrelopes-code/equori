export interface IncomeDraft {
  accountId: string | null;
  cashAccountId: string | null;
  date: string;
  incomeType: string | null;
  // Minor units of the base currency.
  gross: number;
  withheld: number;
  categoryId: string | null;
  withheldCategoryId: string | null;
  description: string;
}

export function emptyIncome(
  date: string,
  accountId: string | null = null,
): IncomeDraft {
  return {
    accountId,
    cashAccountId: null,
    date,
    incomeType: null,
    gross: 0,
    withheld: 0,
    categoryId: null,
    withheldCategoryId: null,
    description: "",
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
    "incomeType" in draft
  );
}
