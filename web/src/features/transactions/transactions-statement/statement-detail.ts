import type { TransactionRow } from "@/features/transactions/model/transaction-row";

export interface StatementDetail {
  // A state the reader acts on, written before the text in its own tone.
  flag: "uncategorized" | "voided" | undefined;
  text: string;
}

type DetailRow = Pick<
  TransactionRow,
  "accounts" | "uncategorized" | "transfer" | "voided"
>;

// The line under a statement row's title (spec 2026-11-21-mobile-statement, MS4): the category
// and the accounts; a voided or uncategorized row names its state, a transfer its accounts.
export function statementDetail(
  row: DetailRow,
  category: string | undefined,
): StatementDetail {
  if (row.voided) return { flag: "voided", text: row.accounts };

  if (row.uncategorized) return { flag: "uncategorized", text: row.accounts };

  if (row.transfer) return { flag: undefined, text: row.accounts };

  const text = [category ?? "", row.accounts]
    .filter((part) => part !== "")
    .join(" · ");

  return { flag: undefined, text };
}
