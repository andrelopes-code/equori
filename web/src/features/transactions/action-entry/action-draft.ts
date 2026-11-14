import type { ActionKind } from "@/features/transactions/action-entry/action-kind";

export interface ActionDraft {
  brokerageId: string | null;
  // The code of the investment.
  instrument: string | null;
  kind: ActionKind;
  // The first day without the right.
  date: string;
  ratioFrom: number | null;
  ratioTo: number | null;
  // As typed; parsed when the action is sent.
  unitCost: string;
  categoryId: string | null;
  description: string;
}

export function emptyAction(
  date: string,
  brokerageId: string | null = null,
): ActionDraft {
  return {
    brokerageId,
    instrument: null,
    kind: "split",
    date,
    ratioFrom: null,
    ratioTo: null,
    unitCost: "",
    categoryId: null,
    description: "",
  };
}

export function isActionDraft(value: unknown): value is ActionDraft {
  if (typeof value !== "object" || value === null) return false;
  const draft = value as Record<string, unknown>;
  return (
    typeof draft.date === "string" &&
    typeof draft.kind === "string" &&
    typeof draft.unitCost === "string" &&
    typeof draft.description === "string" &&
    "ratioFrom" in draft &&
    "brokerageId" in draft &&
    "instrument" in draft
  );
}
