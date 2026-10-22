import type { components } from "@/api/schema.gen";

type Transaction = components["schemas"]["Transaction"];

// The last transactions read for a suggestion, and the share and count one account needs
// among them to be suggested.
export const suggestionWindow = 10;
const minShare = 0.6;
const minCount = 3;

export interface Suggestion {
  accountId: string;
  count: number;
  total: number;
}

// The account most used by the recent transactions of a category or payee, when its use is
// frequent enough to predict the next one. Each transaction counts once, for the first of
// its postings on a candidate account.
export function suggestAccount(
  recent: readonly Transaction[],
  candidates: ReadonlySet<string>,
): Suggestion | null {
  const counts = new Map<string, number>();
  let total = 0;
  for (const t of recent.slice(0, suggestionWindow)) {
    const used = t.postings.find((p) => candidates.has(p.account_id));
    if (used === undefined) continue;
    total += 1;
    counts.set(used.account_id, (counts.get(used.account_id) ?? 0) + 1);
  }
  let best: Suggestion | null = null;
  for (const [accountId, count] of counts) {
    if (best === null || count > best.count) {
      best = { accountId, count, total };
    }
  }
  if (best === null || best.count < minCount || best.count / total < minShare)
    return null;
  return best;
}
