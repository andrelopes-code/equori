import { roundHalfEven } from "@/features/calculators/model/round";
import {
  accumulated,
  type IndexRate,
} from "@/features/calculators/rate-source/index-rates";

interface CorrectionAnswer {
  // Minor units.
  corrected: number;
  // The accumulated change, as a fraction.
  change: number;
  months: number;
}

type MonthsStatus = "inside" | "order" | "range" | "unknown";

// Whether the months can be read from the stored ones: a start after the end is "order", a month
// outside the stored ones is "range", and "unknown" holds while a month or a bound is missing.
export function monthsStatus(
  from: string | null,
  to: string | null,
  first: string | undefined,
  last: string | undefined,
): MonthsStatus {
  if (from === null || to === null) return "unknown";
  if (from > to) return "order";
  if (first === undefined || last === undefined) return "unknown";

  return from >= first && to <= last ? "inside" : "range";
}

// M7: the amount times the product of (1 + rate); null while the amount or the rates are missing.
export function correctionAnswer(
  amount: number | null,
  rates: readonly IndexRate[] | undefined,
): CorrectionAnswer | null {
  if (amount === null || rates === undefined || rates.length === 0) return null;

  const change = accumulated(rates);

  return {
    corrected: roundHalfEven(amount * (1 + change)),
    change,
    months: new Set(rates.map((r) => r.date.slice(0, 7))).size,
  };
}
