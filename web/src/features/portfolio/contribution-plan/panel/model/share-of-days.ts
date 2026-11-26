import type { components } from "@/api/schema.gen";

type Index = components["schemas"]["SentimentIndex"];

// The part of the stored days at the limit or below it, from 0 to 1; undefined without any day.
export function shareOfDays(index: Index, limit: number): number | undefined {
  if (index.days === 0) return undefined;

  const days = index.counts
    .slice(0, limit + 1)
    .reduce((sum, count) => sum + count, 0);

  return days / index.days;
}
