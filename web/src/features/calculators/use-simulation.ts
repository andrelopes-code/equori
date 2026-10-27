import { useMemo } from "react";

import { simulate } from "@/features/calculators/simulation";

// The range of outcomes of the compound calculator, or null without a volatility. 2,000 paths
// of up to 1,200 months are computed once per change of the inputs, not on every render.
export function useSimulation(
  initial: number,
  deposit: number | null,
  months: number | null,
  annualRate: number | null,
  annualVolatility: number | null,
): { p10: number; p50: number; p90: number } | null {
  return useMemo(
    () =>
      deposit === null ||
      months === null ||
      annualRate === null ||
      annualVolatility === null ||
      annualVolatility < 0
        ? null
        : simulate({ initial, deposit, months, annualRate, annualVolatility }),
    [initial, deposit, months, annualRate, annualVolatility],
  );
}
