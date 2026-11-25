import type { components } from "@/api/schema.gen";

export type VersusField =
  | "date"
  | "value"
  | "plan"
  | "aheadLower"
  | "aheadUpper"
  | "behindLower"
  | "behindUpper";

// One record per date, in major units of the currency: what the chart reads.
export interface VersusRow extends Record<VersusField, unknown> {
  date: string;
  value: number;
  plan: number;
  aheadLower: number;
  aheadUpper: number;
  behindLower: number;
  behindUpper: number;
}

// PX7: both lines start on the baseline value. The ahead range runs from the plan line up to the
// recorded value where it is above; the behind range from the recorded value up to the plan line
// where it is below. Each is empty (both bounds on the plan line) where it does not apply.
export function versusRows(
  baseline: components["schemas"]["ProjectionBaseline"],
  since: readonly components["schemas"]["ReturnSeriesPoint"][],
  line: readonly number[],
  scale: number,
): VersusRow[] {
  const divisor = 10 ** scale;
  const row = (date: string, value: number, plan: number): VersusRow => ({
    date,
    value,
    plan,
    aheadLower: plan,
    aheadUpper: Math.max(value, plan),
    behindLower: Math.min(value, plan),
    behindUpper: plan,
  });

  return [
    row(baseline.date, baseline.value / divisor, baseline.value / divisor),
    ...since.map((p, i) =>
      row(p.date, p.value / divisor, (line[i] ?? 0) / divisor),
    ),
  ];
}
