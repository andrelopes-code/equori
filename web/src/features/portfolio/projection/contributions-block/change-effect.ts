import type { components } from "@/api/schema.gen";
import { journeyMonths } from "@/features/portfolio/projection/journey-block/journey-months";
import { monthlyRate } from "@/features/portfolio/projection/model/monthly-rate";
import type { ProjectionDraft } from "@/features/portfolio/projection/model/plan-fields";
import { project } from "@/features/portfolio/projection/model/project";
import type { ProjectInput } from "@/features/portfolio/projection/model/project";

type Change = components["schemas"]["ProjectionChange"];

type ProjectBase = Omit<ProjectInput, "changes">;

// Amounts in minor units of the plan currency, in today's money.
export interface ChangeEffect {
  value: number;
  without: number;
  difference: number;
}

// PX9: the value at the withdrawal age with the change against the plan without it; `others` are
// the other changes of the plan.
export function changeEffect(
  base: ProjectBase,
  others: readonly Change[],
  change: Change,
): ChangeEffect {
  const without = valueAtWithdrawal(base, others);
  const value = valueAtWithdrawal(base, [...others, change]);

  return { value, without, difference: value - without };
}

// The projection of the draft from today's recorded value; withdrawals do not change the value
// before them, so the income is zero.
export function projectBase(
  draft: ProjectionDraft,
  history: components["schemas"]["ReturnSeries"],
  birthDate: string,
  today: string,
): ProjectBase {
  const { months, withdrawalFrom } = journeyMonths(
    today,
    birthDate,
    draft.withdrawalAge,
    draft.lastAge,
  );

  return {
    start: history.points.at(-1)?.value ?? history.opening,
    monthlyRate: monthlyRate(draft.realReturnBp),
    months,
    withdrawalFrom,
    income: 0,
  };
}

function valueAtWithdrawal(base: ProjectBase, changes: readonly Change[]) {
  const rows = project({ ...base, changes });

  return (
    rows.filter((r) => r.month < base.withdrawalFrom).at(-1)?.value ??
    base.start
  );
}
