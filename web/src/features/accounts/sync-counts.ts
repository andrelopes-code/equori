import type { components } from "@/api/schema.gen";

type ImportCounts = components["schemas"]["ImportCounts"];

export type SyncCountKey =
  | "created"
  | "matched"
  | "needs_review"
  | "updated"
  | "withdrawn"
  | "re_identified";

const order: SyncCountKey[] = [
  "created",
  "matched",
  "needs_review",
  "updated",
  "withdrawn",
  "re_identified",
];

// The counts a sync summary states, in display order; a zero count is left out.
export function syncCounts(
  counts: ImportCounts,
): { key: SyncCountKey; count: number }[] {
  return order
    .filter((key) => counts[key] > 0)
    .map((key) => ({ key, count: counts[key] }));
}
