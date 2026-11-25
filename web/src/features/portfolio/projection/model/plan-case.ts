import {
  amountNeeded,
  sustainedIncome,
} from "@/features/portfolio/projection/model/amount-needed";
import { ageAt } from "@/features/portfolio/projection/model/age-at";
import {
  basisAfter,
  gainShare,
} from "@/features/portfolio/projection/model/gain-tax";
import { incomeEnd } from "@/features/portfolio/projection/model/income-end";
import { monthlyRate } from "@/features/portfolio/projection/model/monthly-rate";
import type { ProjectionDraft } from "@/features/portfolio/projection/model/plan-fields";
import { project } from "@/features/portfolio/projection/model/project";
import type { ProjectionRow } from "@/features/portfolio/projection/model/project";

export interface PlanCaseInput {
  draft: ProjectionDraft;
  // Today's recorded value and the money contributed so far, the basis of the tax; it is negative
  // when more was taken out than put in, and then the whole value is gain.
  start: number;
  basis: number;
  months: readonly string[];
  withdrawalFrom: string;
  birthDate: string;
}

// One projection of the plan, in minor units of today's money.
export interface PlanCase {
  rows: ProjectionRow[];
  atWithdrawal: number;
  // Income mode only: the amount needed and the share of it the case reaches.
  needed: number | null;
  covered: number | null;
  sustained: number;
  // Income mode only: whether the value lasts to the last age, and the age it ends when not.
  sustains: boolean | null;
  endAge: number | null;
}

// PX4, PX5, PX14, PX15: the projection of the draft with `returnBp` in place of its real return; the
// return during the withdrawals moves by the same difference.
export function planCase(input: PlanCaseInput, returnBp: number): PlanCase {
  const { draft, withdrawalFrom } = input;
  const withdrawalBp = draft.withdrawalReturnBp ?? draft.realReturnBp;
  const withdrawalRate = monthlyRate(
    withdrawalBp + returnBp - draft.realReturnBp,
  );
  const inflation = monthlyRate(draft.inflationBp);
  const taxRate = (draft.gainTaxBp ?? 0) / 10000;
  const tax =
    taxRate === 0
      ? undefined
      : { rate: taxRate, basis: Math.max(input.basis, 0), inflation };
  const base = {
    start: input.start,
    monthlyRate: monthlyRate(returnBp),
    withdrawalRate,
    months: input.months,
    changes: draft.changes,
    withdrawalFrom,
    tax,
  };

  // The months before the withdrawals do not depend on the income.
  const saving = project({ ...base, income: 0 }).filter(
    (r) => r.month < withdrawalFrom,
  );
  const atWithdrawal = saving.at(-1)?.value ?? input.start;
  const share =
    tax === undefined
      ? 0
      : gainShare(atWithdrawal, basisAfter(tax.basis, inflation, saving));
  const wanted =
    draft.withdrawal.mode === "income" ? (draft.withdrawal.income ?? 0) : null;
  const needed =
    wanted === null
      ? null
      : amountNeeded(
          wanted,
          (draft.lastAge - draft.withdrawalAge) * 12,
          withdrawalRate,
          tax && { rate: taxRate, basisShare: 1 - share, inflation },
        );
  const ofRate =
    sustainedIncome(atWithdrawal, draft.withdrawal.rate_bp ?? 0) *
    (1 - taxRate * share);
  const rows = project({ ...base, income: wanted ?? ofRate });
  const end = wanted === null ? null : incomeEnd(rows);

  return {
    rows,
    atWithdrawal,
    needed,
    covered: shareOf(atWithdrawal, needed),
    sustained:
      wanted === null ? ofRate : wanted * (shareOf(atWithdrawal, needed) ?? 0),
    sustains: wanted === null ? null : end === null,
    endAge: end === null ? null : ageAt(input.birthDate, `${end}-01`),
  };
}

function shareOf(value: number, needed: number | null): number | null {
  return needed === null || needed === 0 ? null : value / needed;
}
