import type { components } from "@/api/schema.gen";
import { contributionIn } from "@/features/portfolio/projection/model/contribution-in";
import { monthlyRate } from "@/features/portfolio/projection/model/monthly-rate";

type Change = components["schemas"]["ProjectionChange"];

// PX7: one value per recorded month. The line starts on the first recorded value and grows by the
// nominal monthly rate, `((1 + real)(1 + inflation))^(1/12) - 1`. A month up to the baseline month
// (`YYYY-MM`) adds its recorded flows: no intention existed then. A later month adds the
// contribution in force.
export function planLine(
  points: readonly { date: string; value: number; flows: number }[],
  baselineMonth: string,
  changes: readonly Change[],
  realBp: number,
  inflationBp: number,
): number[] {
  const nominalBp =
    ((1 + realBp / 10000) * (1 + inflationBp / 10000) - 1) * 10000;
  const rate = monthlyRate(nominalBp);
  let value = 0;

  return points.map((p, i) => {
    const month = p.date.slice(0, 7);
    const added =
      month <= baselineMonth ? p.flows : contributionIn(changes, month);
    value = i === 0 ? p.value : value * (1 + rate) + added;

    return value;
  });
}
