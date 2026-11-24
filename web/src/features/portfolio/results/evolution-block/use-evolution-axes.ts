import type {
  ChartNumberFormat,
  ChartXAxis,
  ChartYAxis,
} from "@slotted/core/chart";

import type { EvolutionField } from "@/features/portfolio/results/evolution-block/evolution-rows";
import { timeFormat } from "@/features/portfolio/results/return-block/plot-rows";
import { useMoneyFormat } from "@/privacy/use-money-format";

// The pixels the value labels take: both plots take it, so their months start at one place.
const labelWidth = 88;

export interface EvolutionAxes {
  x: ChartXAxis<EvolutionField>;
  y: ChartYAxis;
  // The amount of a tooltip, to the minor unit.
  exact: ChartNumberFormat;
}

// The axes the value plot and the flow strip share: the same months on x, the same money format
// and label width on y. The ticks are whole units; the tooltips carry the minor units.
export function useEvolutionAxes(
  currency: string,
  scale: number,
  days: number,
): EvolutionAxes {
  const fmt = useMoneyFormat();

  const whole = (value: number) =>
    fmt.money({ amount: Math.round(value), currency }, 0);
  const exact = (value: number) =>
    fmt.money({ amount: Math.round(value * 10 ** scale), currency }, scale);

  return {
    x: { field: "date", type: "time", format: timeFormat(days) },
    y: { format: whole, labelWidth },
    exact,
  };
}
