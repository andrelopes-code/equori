import { actionKinds } from "@/features/transactions/action-entry/action-kind";
import type { ActionKind } from "@/features/transactions/action-entry/action-kind";
import type { NewTransactionSearch } from "@/features/transactions/model/search";

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
  // A unit tax: the units cancelled and the tax withheld, in minor units.
  quantity: number;
  amount: number;
  categoryId: string | null;
  description: string;
  // A conversion or a spin-off: the code of the security received and, for a spin-off, the
  // percent of the cost it takes, as typed.
  newInstrument: string;
  costPercent: string;
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
    quantity: 0,
    amount: 0,
    categoryId: null,
    description: "",
    newInstrument: "",
    costPercent: "",
  };
}

// The initial values a link of the entry route gives the fields of the form (FC20).
export function actionPreset(
  search: NewTransactionSearch,
): Partial<ActionDraft> {
  const { action, date, quantity } = search;
  const kind = actionKinds.find((k) => k === action);

  return {
    ...(kind === undefined ? {} : { kind }),
    ...(date === undefined ? {} : { date }),
    ...(quantity === undefined ? {} : { quantity }),
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
