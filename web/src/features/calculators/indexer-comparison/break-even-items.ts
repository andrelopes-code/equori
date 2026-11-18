import type { MarketCurve } from "@/features/calculators/api";
import { breakEven } from "@/features/calculators/indexer-comparison/break-even";
import type { ComparisonRow } from "@/features/calculators/indexer-comparison/compare";
import {
  marketFigure,
  type MarketFigure,
} from "@/features/calculators/indexer-comparison/market-view";
import {
  horizonMonths,
  type IndexData,
  type Security,
} from "@/features/calculators/indexer-comparison/security";
import { expectedIndexRate } from "@/features/calculators/indexer-comparison/security-rate";

export interface BreakEvenItem {
  // The position of the floating security in the typed order.
  position: number;
  index: string;
  breakEven: number | null;
  expected: number | null;
  surveyDate: string;
  market: MarketFigure | null;
  // The market figure is an inflation implied by two curves, not a bond rate.
  implied: boolean;
}

// The break-even block (IC4, IC5, IC13): one item per floating security but the reference.
export function breakEvenItems(input: {
  securities: readonly Security[];
  reference: number;
  rows: readonly (ComparisonRow | null)[];
  indexes: ReadonlyMap<string, IndexData>;
  curves: readonly MarketCurve[];
  currency: string;
  maturity: string;
  days: number;
  taxBp: number;
}): BreakEvenItem[] {
  const { securities, reference, rows, indexes, curves, days } = input;
  const referenceRate = rows[reference]?.annualRate ?? null;
  const referenceSecurity = securities[reference];

  return securities.flatMap((security, position) => {
    if (position === reference || security.index === undefined) return [];

    const data = indexes.get(security.index);
    const market =
      data === undefined
        ? null
        : marketFigure(curves, data, input.currency, input.maturity);
    const solved =
      data === undefined ||
      referenceRate === null ||
      referenceSecurity === undefined
        ? null
        : breakEven({
            security,
            data,
            reference: referenceSecurity,
            referenceRate,
            days,
            taxBp: input.taxBp,
          });

    return [
      {
        position,
        index: security.index,
        breakEven: solved,
        expected:
          data === undefined
            ? null
            : expectedIndexRate(data, horizonMonths(days)),
        surveyDate: data?.surveyDate ?? "",
        market,
        implied: data?.period === "month",
      },
    ];
  });
}
