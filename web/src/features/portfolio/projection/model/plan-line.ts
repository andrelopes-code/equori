import type { components } from "@/api/schema.gen";
import { contributionIn } from "@/features/portfolio/projection/model/contribution-in";
import { monthlyRate } from "@/features/portfolio/projection/model/monthly-rate";

type Change = components["schemas"]["ProjectionChange"];

// PX7: the baseline value grown by the nominal monthly rate, `((1 + real)(1 + inflation))^(1/12)
// - 1`, plus the contribution in force each month of `months` (`YYYY-MM`, after the baseline month).
export function planLine(
  baseline: components["schemas"]["ProjectionBaseline"],
  changes: readonly Change[],
  realBp: number,
  inflationBp: number,
  months: readonly string[],
): number[] {
  const nominalBp =
    ((1 + realBp / 10000) * (1 + inflationBp / 10000) - 1) * 10000;
  const rate = monthlyRate(nominalBp);
  let value = baseline.value;

  return months.map((month) => {
    value = value * (1 + rate) + contributionIn(changes, month);

    return value;
  });
}
