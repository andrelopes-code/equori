import type { components } from "@/api/schema.gen";

type Account = components["schemas"]["Account"];
type Transaction = components["schemas"]["Transaction"];

export interface ExpenseCandidate {
  id: string;
  date: string;
  description: string;
  // The sum of the expense postings, in their currency.
  money: components["schemas"]["Money"];
}

// The transactions a goal can pay (planning coherence A256): not voided, with an expense
// posting, and not paid by the goal already; the latest first.
export function expenseCandidates(
  transactions: readonly Transaction[],
  accounts: ReadonlyMap<string, Account>,
  paid: ReadonlySet<string>,
): ExpenseCandidate[] {
  const out: ExpenseCandidate[] = [];
  for (const tx of transactions) {
    if (tx.voided_at !== undefined || paid.has(tx.id)) continue;

    const expenses = tx.postings.filter(
      (p) => accounts.get(p.account_id)?.class === "expense",
    );
    const first = expenses[0];
    if (first === undefined) continue;

    out.push({
      id: tx.id,
      date: tx.date,
      description: tx.description,
      money: {
        amount: expenses.reduce((sum, p) => sum + p.amount.amount, 0),
        currency: first.amount.currency,
      },
    });
  }

  return out.sort((a, b) =>
    a.date === b.date ? (a.id < b.id ? 1 : -1) : a.date < b.date ? 1 : -1,
  );
}
