import type { components } from "@/api/schema.gen";

type Price = components["schemas"]["Price"];

// The contract's enumeration of InstrumentType, in the order the catalog lists the types.
export const instrumentTypes = [
  "currency",
  "stock",
  "etf",
  "reit",
  "depositary_receipt",
  "fixed_income",
  "fund",
  "crypto",
] as const satisfies readonly components["schemas"]["InstrumentType"][];

export function latestPrice(prices: readonly Price[]): Price | undefined {
  return prices.reduce<Price | undefined>(
    (best, p) => (best === undefined || p.date > best.date ? p : best),
    undefined,
  );
}
