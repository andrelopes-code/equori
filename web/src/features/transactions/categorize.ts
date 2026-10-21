import type { components } from "@/api/schema.gen";
import type { TransactionSearch } from "@/features/transactions/search";

type Account = components["schemas"]["Account"];
type Transaction = components["schemas"]["Transaction"];
type CategoryPart = components["schemas"]["CategoryPart"];
type BulkItemResult = components["schemas"]["BulkCategorizeItemResult"];

export const bulkLimit = 200;

function isCategory(account: Account | undefined): boolean {
  return account?.class === "income" || account?.class === "expense";
}

// The category postings summed per category, in the order they first appear.
export function currentParts(
  tx: Transaction,
  accounts: Map<string, Account>,
): CategoryPart[] {
  const parts = new Map<string, CategoryPart>();
  for (const posting of tx.postings) {
    if (!isCategory(accounts.get(posting.account_id))) continue;
    const part = parts.get(posting.account_id);
    if (part === undefined) {
      parts.set(posting.account_id, {
        account_id: posting.account_id,
        amount: { ...posting.amount },
      });
    } else {
      part.amount.amount += posting.amount.amount;
    }
  }
  return [...parts.values()];
}

// One part on the chosen category holding the total of the category side (A18 keeps the total).
export function categoryParts(
  tx: Transaction,
  accounts: Map<string, Account>,
  categoryId: string,
): CategoryPart[] {
  const parts = currentParts(tx, accounts);
  const currency = parts[0]?.amount.currency ?? tx.balancing_currency;
  const total = parts.reduce((sum, p) => sum + p.amount.amount, 0);
  return [{ account_id: categoryId, amount: { amount: total, currency } }];
}

export function chunks<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

export interface BulkSummary {
  categorized: number;
  refused: { status: BulkItemResult["status"]; count: number }[];
}

export function summarizeBulk(results: readonly BulkItemResult[]): BulkSummary {
  const refused = new Map<BulkItemResult["status"], number>();
  let categorized = 0;
  for (const result of results) {
    if (result.status === "categorized") categorized += 1;
    else refused.set(result.status, (refused.get(result.status) ?? 0) + 1);
  }
  return {
    categorized,
    refused: [...refused].map(([status, count]) => ({ status, count })),
  };
}

// Uncategorized transactions that share the payee, or the description when there is no payee.
export function similarSearch(tx: Transaction): TransactionSearch | null {
  if (tx.payee_id !== undefined) {
    return { uncategorized: true, payee_id: tx.payee_id };
  }
  const q = tx.description.trim().slice(0, 100);
  return q === "" ? null : { uncategorized: true, q };
}
