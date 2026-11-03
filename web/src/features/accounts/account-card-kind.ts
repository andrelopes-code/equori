export type AccountCardKind = "checking" | "credit" | "savings";

export function accountCardKind(kind: string | undefined): AccountCardKind {
  if (kind === "credit_card") return "credit";
  if (kind === "savings" || kind === "reserve") return "savings";
  return "checking";
}

// The account's colour slot as the card's colour; without a slot the card keeps its neutral ground.
// The slot is a fixed palette of the app (--equori-slot-N, app.css), not a chart colour.
export function accountCardColor(slot: number | undefined): string | undefined {
  return slot === undefined ? undefined : `var(--equori-slot-${String(slot)})`;
}
