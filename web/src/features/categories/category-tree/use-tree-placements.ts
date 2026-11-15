import { useMemo } from "react";

import type { TreeRow } from "@/features/categories/category-tree/category-tree";
import { useCategoryBuckets } from "@/features/planning";
import type { Placement } from "@/features/planning";

// The bucket of each row's category under the income split; null while the book has none.
export function useTreePlacements(
  rows: readonly TreeRow[],
): ReadonlyMap<string, Placement | undefined> | null {
  const entries = useMemo(() => rows.map((r) => r.entry), [rows]);
  const buckets = useCategoryBuckets(entries);
  const { method, placement } = buckets;
  return useMemo(() => {
    if (method.length === 0) return null;
    return new Map(entries.map((e) => [e.id, placement(e)]));
    // placement is rebuilt each render from method and entries, which the deps cover.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method, entries]);
}
