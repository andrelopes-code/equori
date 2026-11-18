import type { MarketCurve } from "@/features/calculators/api";
import {
  curveRateAt,
  impliedInflation,
} from "@/features/calculators/indexer-comparison/market-rate";

export interface MarketFigure {
  rate: number;
  // The base date of the curve; the older of the two for an implied inflation.
  date: string;
}

// IC13: the rate of a nominal curve for a daily index; the inflation implied by the nominal
// and the real curve of the index for a monthly one. Null without a curve, a point pair that
// surrounds the maturity, or the currency's curve.
export function marketFigure(
  curves: readonly MarketCurve[],
  index: { id: string; period: "day" | "month" },
  currency: string,
  maturity: string,
): MarketFigure | null {
  const nominal = curves.find(
    (c) => c.kind === "nominal" && c.currency === currency,
  );
  const nominalRate =
    nominal === undefined ? null : curveRateAt(nominal.points, maturity);
  if (nominal === undefined || nominalRate === null) return null;
  if (index.period === "day")
    return { rate: nominalRate, date: nominal.baseDate };

  const real = curves.find(
    (c) => c.kind === "real" && c.index === index.id && c.currency === currency,
  );
  const realRate =
    real === undefined ? null : curveRateAt(real.points, maturity);
  if (real === undefined || realRate === null) return null;

  return {
    rate: impliedInflation(nominalRate, realRate),
    date: nominal.baseDate < real.baseDate ? nominal.baseDate : real.baseDate,
  };
}
