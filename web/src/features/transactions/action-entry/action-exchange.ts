import type { components } from "@/api/schema.gen";
import { exchangeKinds } from "@/features/transactions/action-entry/action-kind";
import type { ActionDraft } from "@/features/transactions/action-entry/action-draft";
import type { MessageKey } from "@/i18n/catalog.en";

type CorporateActionInput = components["schemas"]["CorporateActionInput"];

const code = /^[A-Z0-9.]{2,20}$/;
const percent = /^\d{1,2}([.,]\d{1,2})?$/;

// The basis points of a percent typed with at most two decimals, above 0 and below 100; null
// for anything else.
export function costBP(typed: string): number | null {
  const text = typed.trim();
  if (!percent.test(text)) return null;

  const [whole = "", fraction = ""] = text.split(/[.,]/);
  const bp = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));

  return bp >= 1 && bp <= 9999 ? bp : null;
}

// The problems of the fields of a conversion or a spin-off, by request field.
export function exchangeProblems(
  draft: ActionDraft,
): Record<string, MessageKey> {
  if (!exchangeKinds.includes(draft.kind)) return {};

  const problems: Record<string, MessageKey> = {};
  if (!code.test(draft.newInstrument.trim().toUpperCase()))
    problems.new_instrument = "action.required.newInstrument";
  if (draft.kind === "spin_off" && costBP(draft.costPercent) === null)
    problems.cost_bp = "action.required.costPercent";

  return problems;
}

// The fields a conversion or a spin-off adds to the request.
export function exchangeFields(
  draft: ActionDraft,
): Partial<CorporateActionInput> {
  if (!exchangeKinds.includes(draft.kind)) return {};

  const bp = draft.kind === "spin_off" ? costBP(draft.costPercent) : null;

  return {
    new_instrument: draft.newInstrument.trim().toUpperCase(),
    ...(bp === null ? {} : { cost_bp: bp }),
  };
}
