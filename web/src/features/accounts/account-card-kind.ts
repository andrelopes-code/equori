export type AccountCardKind = "checking" | "credit" | "savings";

export function accountCardKind(kind: string | undefined): AccountCardKind {
  if (kind === "credit_card") return "credit";
  if (kind === "savings" || kind === "reserve") return "savings";
  return "checking";
}

// The account's data slot as the card's colour; without a slot the card keeps its neutral ground.
export function accountCardColor(slot: number | undefined): string | undefined {
  return slot === undefined ? undefined : `var(--slotted-data-${String(slot)})`;
}
