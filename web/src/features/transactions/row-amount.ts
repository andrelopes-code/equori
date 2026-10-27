import type { components } from "@/api/schema.gen";

type Account = components["schemas"]["Account"];
type Money = components["schemas"]["Money"];
type Transaction = components["schemas"]["Transaction"];

function isBalanceAccount(account: Account | undefined): boolean {
  return account?.class === "asset" || account?.class === "liability";
}

// The filter covers the account and its descendants, as the API does (A76).
function inSubtree(
  accountsById: Map<string, Account>,
  accountID: string,
  rootID: string,
): boolean {
  for (let id: string | undefined = accountID; id !== undefined;) {
    if (id === rootID) return true;
    id = accountsById.get(id)?.parent_id;
  }
  return false;
}

// With an account filter the row shows the postings of that account's subtree; otherwise the sum of
// the balance-account postings. A category filter negates its postings so that the row keeps the
// sign of the unfiltered list: an income is an inflow, an expense an outflow.
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
      : tx.postings.filter((p) =>
          inSubtree(accountsById, p.account_id, filterAccountId),
        );
  const currency = shown[0]?.amount.currency ?? tx.balancing_currency;
  const sum = shown
    .filter((p) => p.amount.currency === currency)
    .reduce((total, p) => total + p.amount.amount, 0);
  const category =
    filterAccountId !== undefined &&
    !isBalanceAccount(accountsById.get(filterAccountId));
  return { money: { amount: category ? -sum : sum, currency }, transfer };
}
