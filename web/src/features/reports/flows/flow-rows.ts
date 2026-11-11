import type { components } from "@/api/schema.gen";

type FlowDay = components["schemas"]["FlowDay"];

export type FlowBy = "day" | "month";

export interface FlowRow {
  // YYYY-MM-DD for a day, YYYY-MM for a month.
  key: string;
  // Minor units of the account's currency.
  inflow: number;
  outflow: number;
  result: number;
}

export interface FlowTotals {
  inflow: number;
  outflow: number;
  result: number;
}

// The days as they come, or added per month in minor units; oldest first.
export function flowRows(days: readonly FlowDay[], by: FlowBy): FlowRow[] {
  const sums = new Map<string, { inflow: number; outflow: number }>();
  for (const d of days) {
    const key = by === "day" ? d.date : d.date.slice(0, 7);
    const sum = sums.get(key) ?? { inflow: 0, outflow: 0 };
    sums.set(key, {
      inflow: sum.inflow + d.inflow.amount,
      outflow: sum.outflow + d.outflow.amount,
    });
  }
  return [...sums.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, s]) => ({ key, ...s, result: s.inflow - s.outflow }));
}

export function flowTotals(rows: readonly FlowRow[]): FlowTotals {
  const inflow = rows.reduce((sum, r) => sum + r.inflow, 0);
  const outflow = rows.reduce((sum, r) => sum + r.outflow, 0);
  return { inflow, outflow, result: inflow - outflow };
}
