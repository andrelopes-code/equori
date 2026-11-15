import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import type { CategoryEntry } from "@/features/categories";
import {
  budgetBucketsQuery,
  useSaveBudgetBuckets,
} from "@/features/planning/api";
import {
  choiceOf,
  withChoice,
} from "@/features/planning/income-split/bucket-draft";
import { bucketResolver } from "@/features/planning/income-split/bucket-figures";

export interface Placement {
  name: string;
  // The bucket comes from an ancestor, not from the category itself.
  inherited: boolean;
}

// The book's income split as the categories screen reads and changes it: the bucket each
// category resolves to, its own choice, and the save that moves one category.
export function useCategoryBuckets(entries: readonly CategoryEntry[]) {
  const api = useApi();
  const query = useQuery(budgetBucketsQuery(api));
  const save = useSaveBudgetBuckets();
  const method = query.data?.buckets ?? [];
  const resolve = bucketResolver(method, entries);

  return {
    method,
    // The bucket of a category; undefined outside the split.
    placement: (entry: CategoryEntry): Placement | undefined => {
      const bucket = resolve(entry.id);
      if (bucket === undefined) return undefined;
      return {
        name: bucket.name,
        inherited: !bucket.category_ids.includes(entry.id),
      };
    },
    choiceFor: (categoryId: string, isRoot: boolean) =>
      choiceOf(method, categoryId, isRoot),
    // Moves one category to choice, keeping the rest of the method.
    assign: async (categoryId: string, choice: string) => {
      await save.mutateAsync(withChoice(method, categoryId, choice));
    },
  };
}
