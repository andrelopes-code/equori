import type { components } from "@/api/schema.gen";

type Transaction = components["schemas"]["Transaction"];
type PostingStatus = "pending" | "cleared" | "reconciled";

export interface LedgerRow {
  id: string;
  date: string;
  transaction: Transaction;
  // The signed sum of the postings on the account and its sub-accounts; zero once voided.
  amount: number;
  currency: string;
  // The least advanced state of those postings: a movement is reconciled when all of them are.
  status: PostingStatus;
  // The other accounts the movement touched, in posting order.
  counterparts: string[];
  voided: boolean;
}

const rank: Record<PostingStatus, number> = {
  pending: 0,
  cleared: 1,
  reconciled: 2,
};

export function ledgerRows(
  transactions: readonly Transaction[],
  accountIds: ReadonlySet<string>,
): LedgerRow[] {
  return transactions.map((transaction) => {
    const own = transaction.postings.filter((p) =>
      accountIds.has(p.account_id),
    );
    const voided = transaction.voided_at !== undefined;
    const status = own.reduce<PostingStatus>((least, p) => {
      const state: PostingStatus = p.status ?? "pending";
      return rank[state] < rank[least] ? state : least;
    }, "reconciled");
    const counterparts = transaction.postings
      .filter((p) => !accountIds.has(p.account_id))
      .map((p) => p.account_id)
      .filter((id, i, all) => all.indexOf(id) === i);
    return {
      id: transaction.id,
      date: transaction.date,
      transaction,
      amount: voided ? 0 : own.reduce((sum, p) => sum + p.amount.amount, 0),
      currency: own[0]?.amount.currency ?? transaction.balancing_currency,
      status,
      counterparts,
      voided,
    };
  });
}

// LG-02: the balance after each movement, walked back from the balance at the period's end:
// the newest row left the closing balance, and each older one the balance before the newer.
export function runningBalances(
  rows: readonly { id: string; amount: number }[],
  closing: number,
): Map<string, number> {
  const balances = new Map<string, number>();
  let after = closing;
  for (const row of rows) {
    balances.set(row.id, after);
    after -= row.amount;
  }
  return balances;
}
