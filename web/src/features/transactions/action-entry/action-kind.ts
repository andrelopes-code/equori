import type { components } from "@/api/schema.gen";
import type { MessageKey } from "@/i18n/catalog.en";

export type ActionKind = components["schemas"]["CorporateActionKind"];

export const actionKinds = ["split", "reverse_split", "bonus"] as const;

export const actionKindKeys = {
  split: "action.kind.split",
  reverse_split: "action.kind.reverse_split",
  bonus: "action.kind.bonus",
} satisfies Record<ActionKind, MessageKey>;
