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

// PX7: one row per recorded month; `line` holds the plan line of the same months. The ahead range
// runs from the plan line up to the recorded value where it is above; the behind range from the
// recorded value up to the plan line where it is below. Each is empty (both bounds on the plan
// line) where it does not apply.
export function versusRows(
  points: readonly components["schemas"]["ReturnSeriesPoint"][],
  line: readonly number[],
  scale: number,
): VersusRow[] {
  const divisor = 10 ** scale;

  return points.map((p, i) => {
    const value = p.value / divisor;
    const plan = (line[i] ?? 0) / divisor;

    return {
      date: p.date,
      value,
      plan,
      aheadLower: plan,
      aheadUpper: Math.max(value, plan),
      behindLower: Math.min(value, plan),
      behindUpper: plan,
    };
  });
}
