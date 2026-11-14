export interface CustodyDraft {
  // The brokerage that gives.
  brokerageId: string | null;
  // The code of the investment.
  instrument: string | null;
  // The brokerage that receives.
  toId: string | null;
  date: string;
  // Minor units of the investment.
  quantity: number;
  description: string;
}

export function emptyCustody(
  date: string,
  brokerageId: string | null = null,
): CustodyDraft {
  return {
    brokerageId,
    instrument: null,
    toId: null,
    date,
    quantity: 0,
    description: "",
  };
}

export function isCustodyDraft(value: unknown): value is CustodyDraft {
  if (typeof value !== "object" || value === null) return false;
  const draft = value as Record<string, unknown>;

  return (
    typeof draft.date === "string" &&
    typeof draft.quantity === "number" &&
    typeof draft.description === "string" &&
    "toId" in draft &&
    "brokerageId" in draft &&
    "instrument" in draft
  );
}
