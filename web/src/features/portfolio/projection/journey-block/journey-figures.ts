import type { components } from "@/api/schema.gen";
import { journeyMonths } from "@/features/portfolio/projection/journey-block/journey-months";
import {
  amountNeeded,
  sustainedIncome,
  wayShare,
} from "@/features/portfolio/projection/model/amount-needed";
import { ageAt } from "@/features/portfolio/projection/model/age-at";
import { incomeEnd } from "@/features/portfolio/projection/model/income-end";
import { monthlyRate } from "@/features/portfolio/projection/model/monthly-rate";
import type { ProjectionDraft } from "@/features/portfolio/projection/model/plan-fields";
import { planLine } from "@/features/portfolio/projection/model/plan-line";
import { project } from "@/features/portfolio/projection/model/project";
import type {
  ProjectInput,
  ProjectionRow,
} from "@/features/portfolio/projection/model/project";
import { versusFigures } from "@/features/portfolio/projection/model/versus-figures";
import type { VersusFigures } from "@/features/portfolio/projection/model/versus-figures";
import { contributed } from "@/features/portfolio/results/model/wealth";

type ReturnSeries = components["schemas"]["ReturnSeries"];

export interface JourneyInput {
  draft: ProjectionDraft;
  history: ReturnSeries;
  birthDate: string;
  today: string;
  baseline: components["schemas"]["ProjectionBaseline"] | undefined;
}

// Amounts in minor units of the plan currency, in today's money.
export interface JourneyFigures {
  rows: ProjectionRow[];
  withdrawalFrom: string;
  withdrawalAge: number;
  lastAge: number;
  today: number;
  atWithdrawal: number;
  // The money contributed up to the withdrawal age, and the return over it.
  contributed: number;
  gain: number;
  // Income mode only: the amount needed, the share of it the plan reaches and the share of the way.
  needed: number | null;
  covered: number | null;
  way: number | null;
  income: number | null;
  sustained: number;
  // Income mode only: whether the value lasts to the last age, and the age it ends when not.
  sustains: boolean | null;
  endAge: number | null;
  versus: VersusFigures | null;
}

// PX4 to PX7: the projection of the draft from today's recorded value and the figures the side of
// the journey states.
export function journeyFigures(input: JourneyInput): JourneyFigures {
  const { draft, history, birthDate } = input;
  const { months, withdrawalFrom } = journeyMonths(
    input.today,
    birthDate,
    draft.withdrawalAge,
    draft.lastAge,
  );
  const today = history.points.at(-1)?.value ?? history.opening;
  const rate = monthlyRate(draft.realReturnBp);
  const rows = projectRows(
    {
      start: today,
      monthlyRate: rate,
      months,
      changes: draft.changes,
      withdrawalFrom,
    },
    draft.withdrawal,
  );
  const before = rows.filter((r) => r.month < withdrawalFrom);
  const atWithdrawal = before.at(-1)?.value ?? today;
  const total =
    (contributed(history.opening, history.points).at(-1) ?? history.opening) +
    before.reduce((sum, r) => sum + r.contribution, 0);
  const income =
    draft.withdrawal.mode === "income" ? (draft.withdrawal.income ?? 0) : null;
  const needed =
    income === null
      ? null
      : amountNeeded(income, (draft.lastAge - draft.withdrawalAge) * 12, rate);
  const end = income === null ? null : incomeEnd(rows);

  return {
    rows,
    withdrawalFrom,
    withdrawalAge: draft.withdrawalAge,
    lastAge: draft.lastAge,
    today,
    atWithdrawal,
    contributed: total,
    gain: atWithdrawal - total,
    needed,
    covered: needed === null || needed === 0 ? null : atWithdrawal / needed,
    way: wayShare(today, needed),
    income,
    sustained: sustainedFor(draft, atWithdrawal, needed),
    sustains: income === null ? null : end === null,
    endAge: end === null ? null : ageAt(birthDate, `${end}-01`),
    versus: versusSinceBaseline(input),
  };
}

// Rate mode withdraws what the value at the withdrawal age sustains (PX5), so it runs twice.
function projectRows(
  base: Omit<ProjectInput, "income">,
  withdrawal: ProjectionDraft["withdrawal"],
): ProjectionRow[] {
  if (withdrawal.mode === "income")
    return project({ ...base, income: withdrawal.income ?? 0 });

  const saving = project({ ...base, income: 0 });
  const value =
    saving.filter((r) => r.month < base.withdrawalFrom).at(-1)?.value ??
    base.start;

  return project({
    ...base,
    income: sustainedIncome(value, withdrawal.rate_bp ?? 0),
  });
}

// PX5: the income a value sustains; in income mode the desired income scaled by the value over
// the amount needed.
function sustainedFor(
  draft: ProjectionDraft,
  value: number,
  needed: number | null,
): number {
  const { withdrawal } = draft;
  if (withdrawal.mode === "rate")
    return sustainedIncome(value, withdrawal.rate_bp ?? 0);

  return needed === null || needed === 0
    ? 0
    : ((withdrawal.income ?? 0) * value) / needed;
}

// PX7: the recorded points after the baseline month against the plan line of the same months.
function versusSinceBaseline(input: JourneyInput): VersusFigures | null {
  const { baseline, draft, history } = input;
  if (baseline === undefined) return null;

  const since = history.points.filter(
    (p) => p.date.slice(0, 7) > baseline.date.slice(0, 7),
  );
  const line = planLine(
    baseline,
    draft.changes,
    draft.realReturnBp,
    draft.inflationBp,
    since.map((p) => p.date.slice(0, 7)),
  );

  return versusFigures(since, line);
}
