import type { components } from "@/api/schema.gen";

type Placement = components["schemas"]["StatementPlacement"];

// A136: within this many days before the closing date the bank may still bill a purchase on
// the next statement; it equals the ledger's ProvisionalWindow.
const provisionalWindow = 10;

const dayMs = 86_400_000;

export interface StatementOffer {
  current: string;
  next: string;
}

// The two statements a card purchase dated date may land on, or null when its statement is
// not in doubt.
export function statementOffer(
  date: string,
  placement: Placement | null | undefined,
): StatementOffer | null {
  if (placement === null || placement === undefined) return null;

  const days = (Date.parse(placement.closing_date) - Date.parse(date)) / dayMs;
  if (days < 0 || days > provisionalWindow) return null;

  return {
    current: placement.reference,
    next: nextReference(placement.reference),
  };
}

function nextReference(reference: string): string {
  const [year = 0, month = 0] = reference.split("-").map(Number);
  const next = month === 12 ? [year + 1, 1] : [year, month + 1];
  return `${String(next[0])}-${String(next[1]).padStart(2, "0")}`;
}

// The statement the request names when the owner picks chosen. null leaves it to the date,
// which holds only while nothing else was chosen; a correction moving back names it.
export function statementToSend(
  chosen: string,
  value: string | null,
  offer: StatementOffer,
): string | null {
  return value === null && chosen === offer.current ? null : chosen;
}

// Whether the choice can show value: a statement the bank chose outside the two offered
// stays as it is, without a choice.
export function offerHolds(
  value: string | null,
  offer: StatementOffer,
): boolean {
  return value === null || value === offer.current || value === offer.next;
}
