import type { components } from "@/api/schema.gen";

type ReturnReport = components["schemas"]["ReturnReport"];

export interface Reconciliation {
  opening: number;
  deposits: number;
  // The magnitude of the flows that left, never negative.
  withdrawals: number;
  // closing - opening - deposits + withdrawals.
  result: number;
  closing: number;
  // The flows left out because their currency is not the opening currency.
  excluded: number;
}

// L3: the two ends of the period, the money that entered and left, and what the balance gained.
// Only flows in the currency of the opening balance are summed; a sum across currencies has no
// meaning (O7).
export function reconcile(
  report: Pick<ReturnReport, "opening" | "closing" | "flows">,
): Reconciliation {
  const { opening, closing, flows } = report;

  let deposits = 0;
  let withdrawals = 0;
  let excluded = 0;

  for (const { amount } of flows) {
    if (amount.currency !== opening.currency) excluded += 1;
    else if (amount.amount > 0) deposits += amount.amount;
    else withdrawals -= amount.amount;
  }

  return {
    opening: opening.amount,
    deposits,
    withdrawals,
    result: closing.amount - opening.amount - deposits + withdrawals,
    closing: closing.amount,
    excluded,
  };
}
