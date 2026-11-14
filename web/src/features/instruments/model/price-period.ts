import type { components } from "@/api/schema.gen";

type Price = components["schemas"]["Price"];

// A period between two calendar dates (ISO), in the order the pointer dragged them.
export interface Period {
  from: string;
  to: string;
}

// The prices dated inside the period, ends included, oldest first; every price without a period.
export function pricesBetween(
  prices: readonly Price[],
  period: Period | null,
): Price[] {
  if (period === null) return [...prices];

  const first = period.from < period.to ? period.from : period.to;
  const last = period.from < period.to ? period.to : period.from;

  return prices
    .filter((p) => p.date >= first && p.date <= last)
    .sort((a, b) => a.date.localeCompare(b.date));
}
