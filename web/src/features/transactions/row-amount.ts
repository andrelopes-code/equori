import type { components } from "@/api/schema.gen";

type Account = components["schemas"]["Account"];
type Money = components["schemas"]["Money"];
type Transaction = components["schemas"]["Transaction"];

function isBalanceAccount(account: Account | undefined): boolean {
  return account?.class === "asset" || account?.class === "liability";
}

// With an account filter the row shows that account's posting; otherwise the sum of the balance-account postings.
// A transfer touches balance accounts only and shows its outflow side.
export function rowAmount(
  tx: Transaction,
  accountsById: Map<string, Account>,
  filterAccountId?: string,
): { money: Money; transfer: boolean } {
  const balancePostings = tx.postings.filter((p) =>
    isBalanceAccount(accountsById.get(p.account_id)),
  );
  const transfer =
    balancePostings.length > 1 && balancePostings.length === tx.postings.length;
  const shown =
    filterAccountId === undefined
      ? transfer
        ? balancePostings.filter((p) => p.amount.amount < 0).slice(0, 1)
        : balancePostings
      : tx.postings.filter((p) => p.account_id === filterAccountId);
  const currency = shown[0]?.amount.currency ?? tx.balancing_currency;
  const amount = shown
    .filter((p) => p.amount.currency === currency)
    .reduce((sum, p) => sum + p.amount.amount, 0);
  return { money: { amount, currency }, transfer };
}
