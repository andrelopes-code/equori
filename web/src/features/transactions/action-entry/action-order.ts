import type { components } from "@/api/schema.gen";
import { parseRate } from "@/features/instruments";
import type { ActionDraft } from "@/features/transactions/action-entry/action-draft";
import { exchangeFields } from "@/features/transactions/action-entry/action-exchange";

type CorporateActionInput = components["schemas"]["CorporateActionInput"];

export interface ActionTarget {
  brokerageID: string;
  instrument: string;
  // The holding account of a unit tax; absent when the brokerage holds none.
  heldID: string | undefined;
  // The base currency of the book; the tax of a unit tax is in it.
  base: string;
}

// The body a valid draft sends. A unit tax names its holding and keeps the ratio 1:1; every
// other kind names the brokerage and the investment.
export function actionOrder(
  draft: ActionDraft,
  target: ActionTarget,
): CorporateActionInput {
  const description = draft.description.trim();
  const described = description === "" ? {} : { description };

  if (draft.kind === "unit_tax") {
    return {
      ...(target.heldID === undefined ? {} : { account_id: target.heldID }),
      kind: draft.kind,
      date: draft.date,
      ratio_from: 1,
      ratio_to: 1,
      quantity: { amount: draft.quantity, currency: target.instrument },
      amount: { amount: draft.amount, currency: target.base },
      ...described,
    };
  }

  if (draft.kind === "capital_return") {
    return {
      brokerage_id: target.brokerageID,
      instrument: target.instrument,
      kind: draft.kind,
      date: draft.date,
      ratio_from: 1,
      ratio_to: 1,
      amount: { amount: draft.amount, currency: target.base },
      ...described,
    };
  }

  const bonus = draft.kind === "bonus";
  const unitCost = bonus ? parseRate(draft.unitCost) : null;

  return {
    brokerage_id: target.brokerageID,
    instrument: target.instrument,
    kind: draft.kind,
    date: draft.date,
    ratio_from: draft.ratioFrom ?? 0,
    ratio_to: draft.ratioTo ?? 0,
    ...(unitCost === null ? {} : { unit_cost: unitCost }),
    ...(bonus && draft.categoryId !== null
      ? { category_id: draft.categoryId }
      : {}),
    ...exchangeFields(draft, target.base),
    ...described,
  };
}
