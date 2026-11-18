import type { components } from "@/api/schema.gen";
import type { MessageKey } from "@/i18n/catalog.en";

export type ActionKind = components["schemas"]["CorporateActionKind"];

export const actionKinds = [
  "split",
  "reverse_split",
  "bonus",
  "unit_tax",
  "conversion",
  "spin_off",
  "right_issue",
  "right_exercise",
  "capital_return",
] as const;

// The kinds that give units of another security (coverage rows E-06 and E-07).
export const exchangeKinds: readonly ActionKind[] = [
  "conversion",
  "spin_off",
  "right_issue",
  "right_exercise",
];

// The unit tax cancels units of a fund (FC25); a conversion and a spin-off exchange the shares of
// a company, which a fund holding offers neither.
export function offeredKinds(fund: boolean): readonly ActionKind[] {
  return actionKinds.filter((k) =>
    fund ? !exchangeKinds.includes(k) : k !== "unit_tax",
  );
}

export const actionKindKeys = {
  split: "action.kind.split",
  reverse_split: "action.kind.reverse_split",
  bonus: "action.kind.bonus",
  unit_tax: "action.kind.unit_tax",
  conversion: "action.kind.conversion",
  spin_off: "action.kind.spin_off",
  right_issue: "action.kind.right_issue",
  right_exercise: "action.kind.right_exercise",
  capital_return: "action.kind.capital_return",
} satisfies Record<ActionKind, MessageKey>;
