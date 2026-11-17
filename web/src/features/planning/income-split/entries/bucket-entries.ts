import type { components } from "@/api/schema.gen";

type Entry = components["schemas"]["BudgetBucketEntry"];

export interface EntryGroup {
  key: string; // category id, "savings" or "goals"
  kind: Entry["kind"];
  categoryId: string | undefined;
  total: number;
  entries: Entry[]; // in the order received
}

// The entries by category, the largest total first; ties by key ascending. Entries of kind
// savings and goals form one group each.
export function entryGroups(entries: readonly Entry[]): EntryGroup[] {
  const groups = new Map<string, EntryGroup>();
  for (const entry of entries) {
    const categoryId = entry.kind === "expense" ? entry.category_id : undefined;
    const key = categoryId ?? entry.kind;
    const group = groups.get(key) ?? {
      key,
      kind: entry.kind,
      categoryId,
      total: 0,
      entries: [],
    };
    group.total += entry.amount.amount;
    group.entries.push(entry);
    groups.set(key, group);
  }

  return [...groups.values()].sort(
    (a, b) => b.total - a.total || a.key.localeCompare(b.key),
  );
}
