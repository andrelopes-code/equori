import type { AmountDirection } from "@/ui/money/amount-tone";
import { directionOf } from "@/ui/money/amount-tone";

export interface SeriesTrend {
  data: readonly (number | null)[];
  // The first price of the series: the dashed reference line.
  first: number;
  // Of the last price against the first.
  direction: AmountDirection;
}

// Fewer than 3 prices draw no line (analytics design 5.1). The values are numbers for the shape
// only: no sum or conversion reads them. A null is a date before the first price: a gap.
const minimumPrices = 3;

export function seriesTrend(
  data: readonly (number | null)[],
): SeriesTrend | null {
  const prices = data.filter((value) => value !== null);
  const first = prices[0];
  const last = prices[prices.length - 1];

  if (
    prices.length < minimumPrices ||
    first === undefined ||
    last === undefined
  )
    return null;

  return { data, first, direction: directionOf(last - first) };
}
