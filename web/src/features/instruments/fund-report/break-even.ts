import type { MarketCurve } from "@/features/calculators";

export interface ReferenceRate {
  curve: string;
  maturity: string;
  baseDate: string;
  rate: number;
}

// FR11: the point of the latest maturity of the first curve of kind "real" in the currency.
export function referenceRate(
  curves: MarketCurve[],
  currency: string,
): ReferenceRate | null {
  const curve = curves.find(
    (c) => c.kind === "real" && c.currency === currency,
  );
  const latest = curve?.points.reduce<MarketCurve["points"][number] | null>(
    (best, p) => (best === null || p.maturity > best.maturity ? p : best),
    null,
  );

  if (curve === undefined || latest === null || latest === undefined) {
    return null;
  }

  return {
    curve: curve.id,
    maturity: latest.maturity,
    baseDate: curve.baseDate,
    rate: latest.rate,
  };
}

// FR10.
export function breakEvenGrowth(yearYield: number, rate: number): number {
  return (rate - yearYield) / (1 + yearYield);
}
