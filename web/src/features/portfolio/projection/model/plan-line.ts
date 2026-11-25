import type { components } from "@/api/schema.gen";
import { contributionIn } from "@/features/portfolio/projection/model/contribution-in";
import { monthlyRate } from "@/features/portfolio/projection/model/monthly-rate";

type Change = components["schemas"]["ProjectionChange"];

// PX7: one value per recorded month. The line starts on the first recorded value and grows by the
// nominal monthly rate, `((1 + real)(1 + inflation))^(1/12) - 1`. A month up to the baseline month
// (`YYYY-MM`) adds its recorded flows: no intention existed then. A later month adds the
// contribution in force, which is today's money: inflation raises it from the month of its change,
// or from the baseline month when the change is older. PX19: a withdrawal month adds its recorded
// flows.
export function planLine(
  points: readonly { date: string; value: number; flows: number }[],
  baselineMonth: string,
  changes: readonly Change[],
  realBp: number,
  inflationBp: number,
  withdrawalFrom: string,
): number[] {
  const nominalBp =
    ((1 + realBp / 10000) * (1 + inflationBp / 10000) - 1) * 10000;
  const rate = monthlyRate(nominalBp);
  const inflation = monthlyRate(inflationBp);
  let value = 0;

  return points.map((p, i) => {
    const month = p.date.slice(0, 7);
    const added =
      month <= baselineMonth || month >= withdrawalFrom
        ? p.flows
        : contributionIn(changes, month) *
          (1 + inflation) ** monthsHeld(changes, baselineMonth, month);
    value = i === 0 ? p.value : value * (1 + rate) + added;

    return value;
  });
}

// The months from the change in force in `month`, or from the baseline month when it is later.
function monthsHeld(
  changes: readonly Change[],
  baselineMonth: string,
  month: string,
): number {
  const since = changes
    .map((c) => c.month.slice(0, 7))
    .filter((m) => m <= month)
    .reduce((latest, m) => (m > latest ? m : latest), baselineMonth);

  return monthNumber(month) - monthNumber(since);
}

function monthNumber(month: string): number {
  return Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7));
}
