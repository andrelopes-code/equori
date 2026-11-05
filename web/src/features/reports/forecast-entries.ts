import type { ForecastEntry } from "@/features/forecast";
import { seriesKey } from "@/features/forecast";

interface Money {
  amount: number;
  currency: string;
}

// The variable entries of the forecast: each posting in `currency` on an income or expense
// category, signed by its effect on net worth, of a transaction neither voided nor realized by an
// occurrence (net worth forecast design, Entry, Variable entry, Series).
export function forecastEntries(
  transactions: readonly {
    id: string;
    date: string;
    description: string;
    payee_id?: string | undefined;
    voided_at?: string | undefined;
    postings: readonly { account_id: string; amount: Money }[];
  }[],
  categories: ReadonlyMap<
    string,
    { name: string; kind: ForecastEntry["kind"] }
  >,
  currency: string,
  realized: ReadonlySet<string>,
): ForecastEntry[] {
  return transactions
    .filter((tx) => tx.voided_at === undefined && !realized.has(tx.id))
    .flatMap((tx) =>
      tx.postings.flatMap((posting) => {
        const category = categories.get(posting.account_id);

        if (category === undefined || posting.amount.currency !== currency) {
          return [];
        }

        return [
          {
            date: tx.date,
            kind: category.kind,
            amount: -posting.amount.amount,
            series: seriesKey(posting.account_id, tx.payee_id, tx.description),
            label: category.name,
          },
        ];
      }),
    );
}
