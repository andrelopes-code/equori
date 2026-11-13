import type { components } from "@/api/schema.gen";

type Position = components["schemas"]["Position"];
type Transaction = components["schemas"]["Transaction"];

interface Share {
  // Minor units: the amount in the account's instrument, the weight in the balancing currency.
  amount: number;
  weight: number;
  instrument: string;
  balancing: string;
}

// A227 IC10: the position of the form's date without the transaction being corrected. A changed
// position carries no average cost: the stored one includes the original.
export function positionWithout(
  held: Position | undefined,
  original: Transaction | undefined,
  accountId: string | undefined,
  date: string,
): Position | undefined {
  const own = shareOf(original, accountId, date);
  if (own === null || accountId === undefined) return held;

  return {
    account_id: accountId,
    instrument: own.instrument,
    quantity: {
      amount: (held?.quantity.amount ?? 0) - own.amount,
      currency: own.instrument,
    },
    cost_basis: {
      amount: (held?.cost_basis.amount ?? 0) - own.weight,
      currency: own.balancing,
    },
  };
}

// A227 IC10: the booked balance of the form's date without the transaction being corrected.
export function balanceWithout(
  balance: number | undefined,
  original: Transaction | undefined,
  accountId: string | undefined,
  date: string,
): number | undefined {
  if (balance === undefined) return undefined;

  const own = shareOf(original, accountId, date);

  return own === null ? balance : balance - own.amount;
}

// The postings original holds on accountId when the balance of date includes them.
function shareOf(
  original: Transaction | undefined,
  accountId: string | undefined,
  date: string,
): Share | null {
  if (
    original === undefined ||
    accountId === undefined ||
    original.date > date
  ) {
    return null;
  }

  const own = original.postings.filter((p) => p.account_id === accountId);
  const first = own[0];
  if (first === undefined) return null;

  // A posting without a weight weighs its amount in the balancing currency.
  return {
    amount: own.reduce((sum, p) => sum + p.amount.amount, 0),
    weight: own.reduce((sum, p) => sum + (p.weight ?? p.amount).amount, 0),
    instrument: first.amount.currency,
    balancing: original.balancing_currency,
  };
}
