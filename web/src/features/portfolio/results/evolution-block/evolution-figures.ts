import { minAnnualDays } from "@/features/portfolio/model/annual-rate-days";
import type { HistoryCut } from "@/features/portfolio/results/evolution-block/evolution-cut";

// The last day of the span in which the money-weighted annual rate is stated (PR9).
const longDays = 3660;

// All in minor units of the series currency.
export interface EvolutionFigures {
  opening: number;
  net: number;
  gain: number;
  closing: number;
}

export type IrrRow = { kind: "short" } | { kind: "rate"; bp: number };

// PR9: return = closing - opening - net contributions.
export function evolutionFigures(cut: HistoryCut): EvolutionFigures {
  const net = cut.points.reduce((sum, p) => sum + p.flows, 0);
  const closing = cut.points.at(-1)?.value ?? cut.opening;

  return {
    opening: cut.opening,
    net,
    gain: closing - cut.opening - net,
    closing,
  };
}

// PR9: under 365 days the row reads "under 12 months"; beyond 3,660 days it is absent, as it is
// while the rate has not arrived.
export function irrRow(
  days: number,
  annualBp: number | undefined,
): IrrRow | null {
  if (days < minAnnualDays) return { kind: "short" };
  if (days > longDays || annualBp === undefined) return null;

  return { kind: "rate", bp: annualBp };
}
