import type { components } from "@/api/schema.gen";
import { journeyMonths } from "@/features/portfolio/projection/journey-block/journey-months";
import { wayShare } from "@/features/portfolio/projection/model/amount-needed";
import { planCase } from "@/features/portfolio/projection/model/plan-case";
import type { PlanCase } from "@/features/portfolio/projection/model/plan-case";
import type { ProjectionDraft } from "@/features/portfolio/projection/model/plan-fields";
import { realHistory } from "@/features/portfolio/projection/model/real-history";
import type { VersusFigures } from "@/features/portfolio/projection/model/versus-figures";
import { versusPath } from "@/features/portfolio/projection/model/versus-path";
import { contributed } from "@/features/portfolio/results/model/wealth";

type ReturnSeries = components["schemas"]["ReturnSeries"];

export interface JourneyInput {
  draft: ProjectionDraft;
  history: ReturnSeries;
  birthDate: string;
  today: string;
  baseline: components["schemas"]["ProjectionBaseline"] | undefined;
}

export type CaseKind = "cautious" | "favorable";

// PX15: the plan with the return of a typed case.
export interface JourneyCase extends PlanCase {
  kind: CaseKind;
  returnBp: number;
}

// Amounts in minor units of the plan currency, in today's money.
export interface JourneyFigures extends PlanCase {
  withdrawalFrom: string;
  // PX19: the withdrawals run from the next month on.
  started: boolean;
  withdrawalAge: number;
  lastAge: number;
  today: number;
  // The money contributed up to the withdrawal age, and the return over it.
  contributed: number;
  gain: number;
  way: number | null;
  income: number | null;
  versus: VersusFigures | null;
  cases: JourneyCase[];
  // PX21: the plan without its other incomes; null while it has none.
  without: PlanCase | null;
}

// PX4 to PX7, PX13 to PX15: the projection of the draft from today's recorded value, the figures the
// side of the journey states and the typed cases.
export function journeyFigures(input: JourneyInput): JourneyFigures {
  const { draft, history, birthDate } = input;
  const { months, withdrawalFrom } = journeyMonths(
    input.today,
    birthDate,
    draft.withdrawalAge,
    draft.lastAge,
  );
  const today = history.points.at(-1)?.value ?? history.opening;
  const caseInput = {
    draft,
    start: today,
    basis: contributedOf(history),
    months,
    withdrawalFrom,
    birthDate,
  };
  const plan = planCase(caseInput, draft.realReturnBp);
  const total =
    contributedOf(realHistory(history) ?? history) +
    plan.rows.reduce((sum, r) => sum + r.contribution, 0);

  return {
    ...plan,
    withdrawalFrom,
    started: withdrawalFrom <= input.today.slice(0, 7),
    withdrawalAge: draft.withdrawalAge,
    lastAge: draft.lastAge,
    today,
    contributed: total,
    gain: plan.atWithdrawal - total,
    way: wayShare(today, plan.needed),
    income:
      draft.withdrawal.mode === "income"
        ? (draft.withdrawal.income ?? 0)
        : null,
    versus:
      input.baseline === undefined
        ? null
        : (versusPath(
            input.baseline,
            draft.changes,
            draft.realReturnBp,
            draft.inflationBp,
            history.points,
            withdrawalFrom,
          )?.figures ?? null),
    cases: typedCases(draft).map(({ kind, returnBp }) => ({
      kind,
      returnBp,
      ...planCase(caseInput, returnBp),
    })),
    without:
      draft.incomes.length === 0
        ? null
        : planCase(
            { ...caseInput, draft: { ...draft, incomes: [] } },
            draft.realReturnBp,
          ),
  };
}

function contributedOf(history: ReturnSeries): number {
  return contributed(history.opening, history.points).at(-1) ?? history.opening;
}

function typedCases(draft: ProjectionDraft) {
  const cases: { kind: CaseKind; returnBp: number }[] = [];
  if (draft.cautiousReturnBp !== undefined)
    cases.push({ kind: "cautious", returnBp: draft.cautiousReturnBp });
  if (draft.favorableReturnBp !== undefined)
    cases.push({ kind: "favorable", returnBp: draft.favorableReturnBp });

  return cases;
}
