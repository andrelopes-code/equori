import type { HistoryCut } from "@/features/portfolio/results/evolution-block/evolution-cut";
import { contributed } from "@/features/portfolio/results/model/wealth";

export type EvolutionField =
  "date" | "value" | "contributed" | "flowIn" | "flowOut";

// One record per month point, in major units of the currency: what the chart reads.
export interface EvolutionRow extends Record<EvolutionField, unknown> {
  date: string;
  value: number;
  contributed: number;
  flowIn: number | null;
  flowOut: number | null;
}

// PR9: the value, the money contributed (opening plus the running sum of the flows) and the flow
// of each month, split into the inflow and the outflow for the strip.
export function evolutionRows(cut: HistoryCut, scale: number): EvolutionRow[] {
  const divisor = 10 ** scale;
  const sums = contributed(cut.opening, cut.points);

  return cut.points.map((p, i) => ({
    date: p.date,
    value: p.value / divisor,
    contributed: (sums[i] ?? 0) / divisor,
    flowIn: p.flows > 0 ? p.flows / divisor : null,
    flowOut: p.flows < 0 ? p.flows / divisor : null,
  }));
}
