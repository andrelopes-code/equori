import type { components } from "@/api/schema.gen";
import { totalsBy } from "@/features/portfolio/year-totals";

type Event = components["schemas"]["IncomeEvent"];
type Money = components["schemas"]["Money"];

export interface IncomeTotals {
  gross: Money[];
  withheld: Money[];
  net: Money[];
}

// The income of a list of events per currency, up to a date when one is given. Amounts of
// different currencies are never added.
export function incomeTotals(
  items: readonly Event[],
  until?: string,
): IncomeTotals {
  const kept =
    until === undefined ? items : items.filter((e) => e.date <= until);
  const sum = (amount: (e: Event) => Money) =>
    totalsBy(kept, () => "", amount).map(({ amount: a, currency }) => ({
      amount: a,
      currency,
    }));

  return {
    gross: sum((e) => e.gross),
    withheld: sum((e) => e.withheld),
    net: sum((e) => ({
      amount: e.gross.amount - e.withheld.amount,
      currency: e.gross.currency,
    })),
  };
}
