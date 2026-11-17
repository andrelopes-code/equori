import type { components } from "@/api/schema.gen";
import type { MessageKey } from "@/i18n/catalog.en";

export type ActionKind = components["schemas"]["CorporateActionKind"];

export const actionKinds = [
  "split",
  "reverse_split",
  "bonus",
  "unit_tax",
] as const;

// The unit tax cancels units of a fund (FC25); no other holding offers it.
export function offeredKinds(fund: boolean): readonly ActionKind[] {
  return fund ? actionKinds : actionKinds.filter((k) => k !== "unit_tax");
}

export const actionKindKeys = {
  split: "action.kind.split",
  reverse_split: "action.kind.reverse_split",
  bonus: "action.kind.bonus",
  unit_tax: "action.kind.unit_tax",
} satisfies Record<ActionKind, MessageKey>;
