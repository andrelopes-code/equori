interface Money {
  amount: number;
  currency: string;
}

export interface ExpenseRow {
  key: string;
  date: string;
  description: string;
  category: string;
  // Minor units of the base currency; a refund is negative.
  amount: number;
}

// The days of a month that hold a net worth: the whole month, or up to today in the current one
// (net worth days design, D3).
export function monthRange(
  month: string,
  today: string,
): { from: string; to: string } {
  const [year = 0, m = 1] = month.split("-").map(Number);
  const last = new Date(Date.UTC(year, m, 0)).toISOString().slice(0, 10);

  return { from: `${month}-01`, to: last < today ? last : today };
}

// Each posting on an expense category in one currency, dated by its transaction, the largest
// first: a card purchase counts on its day, a refund is negative, a transfer between balance
// accounts touches no category, and a voided transaction counts for nothing (D4, D5). With a day,
// only that day's.
export function monthExpenses(
  transactions: readonly {
    id: string;
    date: string;
    description: string;
    voided_at?: string | undefined;
    postings: readonly { account_id: string; amount: Money }[];
  }[],
  categories: ReadonlyMap<string, string>,
  currency: string,
  day: string | undefined,
): ExpenseRow[] {
  return transactions
    .filter(
      (tx) =>
        tx.voided_at === undefined && (day === undefined || tx.date === day),
    )
    .flatMap((tx) =>
      tx.postings.flatMap((posting, i) => {
        const category = categories.get(posting.account_id);

        return category === undefined || posting.amount.currency !== currency
          ? []
          : [
              {
                key: `${tx.id}-${String(i)}`,
                date: tx.date,
                description: tx.description,
                category,
                amount: posting.amount.amount,
              },
            ];
      }),
    )
    .sort((a, b) => b.amount - a.amount || a.date.localeCompare(b.date));
}
