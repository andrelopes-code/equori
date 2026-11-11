interface Money {
  amount: number;
  currency: string;
}

export type CategoryKind = "income" | "expense";

export interface EntryRow {
  key: string;
  date: string;
  description: string;
  category: string;
  kind: CategoryKind;
  // Minor units of the base currency, the effect on net worth: income adds, an expense subtracts.
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

// Each posting on an income or expense category in one currency, dated by its transaction, by
// its effect on net worth, the largest first: a card purchase counts on its day, a transfer
// between balance accounts touches no category, and a voided transaction counts for nothing
// (D4, D5). With a day, only that day's.
export function monthEntries(
  transactions: readonly {
    id: string;
    date: string;
    description: string;
    voided_at?: string | undefined;
    postings: readonly { account_id: string; amount: Money }[];
  }[],
  categories: ReadonlyMap<string, { name: string; kind: CategoryKind }>,
  currency: string,
  day: string | undefined,
): EntryRow[] {
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
                category: category.name,
                kind: category.kind,
                amount: -posting.amount.amount,
              },
            ];
      }),
    )
    .sort(
      (a, b) =>
        Math.abs(b.amount) - Math.abs(a.amount) || a.date.localeCompare(b.date),
    );
}

// Income and expenses of a list of entries, each a positive amount, and their result: a refund
// lowers the expenses rather than adding income.
export function entryTotals(rows: readonly EntryRow[]): {
  income: number;
  expense: number;
  net: number;
} {
  const income = rows
    .filter((row) => row.kind === "income")
    .reduce((sum, row) => sum + row.amount, 0);
  const expense = -rows
    .filter((row) => row.kind === "expense")
    .reduce((sum, row) => sum + row.amount, 0);

  return { income, expense, net: income - expense };
}
