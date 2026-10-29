import type { components } from "@/api/schema.gen";

type Money = components["schemas"]["Money"];

// The sum of the months committed after the open statement, in the card's currency.
export function committedTotal(
  months: readonly { amount: Money | undefined }[],
  currency: string,
): Money {
  return {
    amount: months.reduce((sum, m) => sum + (m.amount?.amount ?? 0), 0),
    currency,
  };
}
