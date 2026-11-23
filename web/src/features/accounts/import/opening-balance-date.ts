import type { components } from "@/api/schema.gen";

type Transaction = components["schemas"]["Transaction"];

// The date of the account's opening balance among the entries of the system account Opening
// balances; undefined when the account has none (S23).
export function openingBalanceDate(
  entries: readonly Transaction[],
  accountId: string,
): string | undefined {
  return entries
    .filter(
      (entry) =>
        entry.voided_at === undefined &&
        entry.postings.some((p) => p.account_id === accountId),
    )
    .map((entry) => entry.date)
    .sort()[0];
}
