import type { MarketCurve } from "@/features/calculators";

// PX17: a rate a year over or of an index, at the end of its term.
export interface PlanReference {
  index: string;
  year: number;
  rate: number;
}

// The longest point of the first real curve in the currency of the plan.
export function longestRealRate(
  curves: readonly MarketCurve[],
  currency: string,
): PlanReference | null {
  const curve = curves.find(
    (c) => c.kind === "real" && c.currency === currency,
  );
  const point = [...(curve?.points ?? [])].sort(byText("maturity")).at(-1);
  if (point === undefined || !curve?.index) return null;

  return {
    index: curve.index,
    year: Number(point.maturity.slice(0, 4)),
    rate: point.rate,
  };
}

// The last point of the survey of an index.
export function expectedInflation(
  index: string,
  points: readonly { date: string; rate: number }[],
): PlanReference | null {
  const point = [...points].sort(byText("date")).at(-1);
  if (point === undefined) return null;

  return { index, year: Number(point.date.slice(0, 4)), rate: point.rate };
}

function byText<K extends string>(key: K) {
  return (a: Record<K, string>, b: Record<K, string>) =>
    a[key].localeCompare(b[key]);
}
