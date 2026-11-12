import type { components } from "@/api/schema.gen";

type Price = components["schemas"]["Price"];

// The distinct sources of the prices, in the order they first appear from the newest date.
export function sourcesOf(prices: readonly Price[]): string[] {
  const newestFirst = [...prices].sort((a, b) => b.date.localeCompare(a.date));

  return [...new Set(newestFirst.map((p) => p.source))];
}
