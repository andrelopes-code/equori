import {
  amountNeeded,
  sustainedIncome,
  sustainedTotal,
} from "@/features/portfolio/projection/model/amount-needed";
import { ageAt } from "@/features/portfolio/projection/model/age-at";
import {
  basisAfter,
  gainShare,
} from "@/features/portfolio/projection/model/gain-tax";
import { incomeEnd } from "@/features/portfolio/projection/model/income-end";
import { monthlyRate } from "@/features/portfolio/projection/model/monthly-rate";
import type { ProjectionDraft } from "@/features/portfolio/projection/model/plan-fields";
import { otherIncomeIn } from "@/features/portfolio/projection/model/other-income";
import { project } from "@/features/portfolio/projection/model/project";
import type { ProjectionRow } from "@/features/portfolio/projection/model/project";
import { shareRounding } from "@/features/portfolio/projection/model/whole-share";

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
  // Income mode only: the amount needed and the share of it the case reaches; nothing needed, the
  // other incomes covering the income, has no share.
  needed: number | null;
  covered: number | null;
  // The total income in income mode, the other incomes included; that of the portfolio in rate mode.
  sustained: number;
  // Income mode only: whether the value lasts to the last age, and the age it ends when not.
  sustains: boolean | null;
  endAge: number | null;
}

// PX4, PX5, PX14, PX15, PX20: the projection of the draft with `returnBp` in place of its real return; the
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
  const neededTax = tax && {
    rate: taxRate,
    basisShare: 1 - share,
    inflation,
  };
  // PX4: an other income takes the place of the portfolio in income mode only.
  const others = (month: string) =>
    otherIncomeIn(draft.incomes, input.birthDate, month);
  const due = (month: string) => Math.max((wanted ?? 0) - others(month), 0);
  const withdrawals = input.months.filter((m) => m >= withdrawalFrom);
  const needed =
    wanted === null
      ? null
      : amountNeeded(withdrawals.map(due), withdrawalRate, neededTax);
  const ofRate =
    sustainedIncome(atWithdrawal, draft.withdrawal.rate_bp ?? 0) *
    (1 - taxRate * share);
  const rows = project({
    ...base,
    income: wanted ?? ofRate,
    others: wanted === null ? undefined : others,
  });
  const covered = shareOf(atWithdrawal, needed);
  // A value that pays the whole last withdrawal and ends on zero sustains the income.
  const sustains =
    wanted === null ? null : covered === null || covered >= 1 - shareRounding;
  const end =
    sustains === false
      ? incomeEnd(rows, (m) => (m < withdrawalFrom ? 0 : due(m)))
      : null;
  const ofIncome =
    draft.incomes.length === 0
      ? (wanted ?? 0) * (covered ?? 0)
      : sustainedTotal(
          atWithdrawal,
          withdrawals.map(others),
          withdrawalRate,
          neededTax,
        );

  return {
    rows,
    atWithdrawal,
    needed,
    covered,
    sustained: wanted === null ? ofRate : ofIncome,
    sustains,
    endAge: end === null ? null : ageAt(input.birthDate, `${end}-01`),
  };
}

function shareOf(value: number, needed: number | null): number | null {
  return needed === null || needed === 0 ? null : value / needed;
}
