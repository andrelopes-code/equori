import type { components } from "@/api/schema.gen";

type BalancePoint = components["schemas"]["BalancePoint"];
type Transaction = components["schemas"]["Transaction"];

export interface Acquisition {
  date: string;
  value: number;
}

export interface ValueChange {
  amount: number;
  // A fraction of the acquisition value: -0.073 reads "−7.3%"; undefined when it was zero.
  fraction: number | undefined;
}

// K1: the first non-zero point of the series, which starts on the account's opening date.
export function acquisition(
  points: readonly BalancePoint[],
): Acquisition | undefined {
  const first = points.find((p) => p.balance.amount !== 0);

  return first === undefined
    ? undefined
    : { date: first.date, value: first.balance.amount };
}

// K2: the current value against the acquisition value.
export function valueChange(value: number, bought: number): ValueChange {
  return {
    amount: value - bought,
    fraction: bought === 0 ? undefined : (value - bought) / bought,
  };
}

// K3: the loans that took part in a transaction that put value into the property.
export function financingLoans(
  propertyId: string,
  transactions: readonly Transaction[],
  loanIds: ReadonlySet<string>,
): string[] {
  const found = new Set<string>();

  for (const tx of transactions) {
    const intoProperty = tx.postings.some(
      (p) => p.account_id === propertyId && p.amount.amount > 0,
    );
    if (!intoProperty) continue;

    for (const p of tx.postings) {
      if (loanIds.has(p.account_id) && p.amount.amount < 0) {
        found.add(p.account_id);
      }
    }
  }

  return [...found];
}
