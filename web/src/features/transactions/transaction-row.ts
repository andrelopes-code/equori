import type { components } from "@/api/schema.gen";
import { rowAmount } from "@/features/transactions/row-amount";

type Account = components["schemas"]["Account"];
type Money = components["schemas"]["Money"];
type Transaction = components["schemas"]["Transaction"];

export interface TransactionRow {
  id: string;
  date: string;
  // Payee name, else description, else the categories; empty when none exists.
  title: string;
  // Category names, without the uncategorized system accounts.
  category: string;
  uncategorized: boolean;
  transfer: boolean;
  // Balance accounts of the row: "from → to" for a transfer.
  accounts: string;
  tags: string[];
  money: Money;
  voided: boolean;
}

function isUncategorized(account: Account): boolean {
  return account.system_role?.startsWith("uncategorized") === true;
}

// With an account filter the row names only the counter account of a transfer;
// the filtered account is the page's own.
export function transactionRow(
  tx: Transaction,
  accountsById: Map<string, Account>,
  payeeNames: Map<string, string>,
  filterAccountId?: string,
): TransactionRow {
  const { money, transfer } = rowAmount(tx, accountsById, filterAccountId);
  const posted = tx.postings.flatMap((p) => {
    const account = accountsById.get(p.account_id);
    return account === undefined ? [] : [{ account, amount: p.amount.amount }];
  });
  const categories = posted.filter(
    ({ account }) => account.class === "income" || account.class === "expense",
  );
  const named = categories.filter(({ account }) => !isUncategorized(account));
  const balance = posted.filter(
    ({ account }) => account.class === "asset" || account.class === "liability",
  );
  const category = named.map(({ account }) => account.name).join(", ");
  let accounts: string;
  if (transfer) {
    const from = balance.filter((p) => p.amount < 0).map((p) => p.account.name);
    const to = balance.filter((p) => p.amount > 0).map((p) => p.account.name);
    accounts = `${from.join(", ")} → ${to.join(", ")}`;
  } else {
    accounts = balance
      .filter(({ account }) => account.id !== filterAccountId)
      .map(({ account }) => account.name)
      .join(", ");
  }
  const payee =
    tx.payee_id === undefined ? undefined : payeeNames.get(tx.payee_id);
  return {
    id: tx.id,
    date: tx.date,
    title: payee ?? (tx.description || category),
    category,
    uncategorized: categories.length > 0 && named.length === 0,
    transfer,
    accounts,
    tags: tx.tags,
    money,
    voided: tx.voided_at !== undefined,
  };
}
