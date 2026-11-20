import type { ViewWindow } from "@/features/assistant/view/view-types";

// The transactions of one category in the period of a view.
export function transactionsHref(accountId: string, w: ViewWindow): string {
  const q = new URLSearchParams({ account_id: accountId });
  if (w.from !== undefined) q.set("from", w.from);
  if (w.to !== undefined) q.set("to", w.to);

  return `/transactions?${q.toString()}`;
}
