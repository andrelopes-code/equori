import type { components } from "@/api/schema.gen";

type AttributionYear = components["schemas"]["AttributionYear"];

export interface YearColumn {
  year: number;
  returnBp?: number | undefined;
  rateBp?: number | undefined;
  inflationBp?: number | undefined;
}

export interface YearScale {
  columns: YearColumn[];
  // The ends of the vertical axis in basis points; low ≤ 0 ≤ high.
  low: number;
  high: number;
}

// The columns of the years and one axis for every column and mark (section 3 of the spec).
export function yearScale(years: readonly AttributionYear[]): YearScale {
  const columns = years.map((y) => ({
    year: y.year,
    returnBp: y.return_bp,
    rateBp: y.rate?.index_bp,
    inflationBp: y.inflation?.index_bp,
  }));
  const values = columns.flatMap((c) =>
    [c.returnBp, c.rateBp, c.inflationBp].filter((v) => v !== undefined),
  );

  return {
    columns,
    low: Math.min(0, ...values),
    high: Math.max(0, ...values),
  };
}

// Where value stands on the axis, in percent of its height from the bottom.
export function heightOf(scale: YearScale, value: number): number {
  const range = scale.high - scale.low;
  if (range === 0) return 0;

  return ((value - scale.low) / range) * 100;
}
