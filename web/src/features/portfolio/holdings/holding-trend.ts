import type { AmountDirection } from "@/ui/money/amount-tone";
import { directionOf } from "@/ui/money/amount-tone";

export interface HoldingTrend {
  data: number[];
  first: number;
  direction: AmountDirection;
}

interface PricePoint {
  date: string;
  value: string;
}

// Fewer than 3 points draw no line (analytics design 5.1). The values are numbers for the shape
// only: no sum or conversion reads them.
const minimumPoints = 3;

export function holdingTrend(
  points: readonly PricePoint[],
): HoldingTrend | null {
  if (points.length < minimumPoints) return null;

  const data = [...points]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((point) => Number(point.value));
  const first = data[0] ?? 0;
  const last = data.at(-1) ?? first;

  return { data, first, direction: directionOf(last - first) };
}
