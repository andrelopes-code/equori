import type { components } from "@/api/schema.gen";

type PricePoint = components["schemas"]["PricePoint"];

// The prices in the units of today: a price before a split is the one a holder of today's units had
// (A266 SA6). The traded close stays in the price that came.
export function adjustedPrices(prices: readonly PricePoint[]): PricePoint[] {
  return prices.map((p) =>
    p.adjusted === undefined ? p : { ...p, value: p.adjusted },
  );
}
