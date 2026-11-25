import type { components } from "@/api/schema.gen";
import type { OtherIncome } from "@/features/portfolio/projection/model/other-income";
import { parseBasisPoints } from "@/features/portfolio/projection/model/parse-percent";
import {
  premiseRanges,
  premisesFrom,
} from "@/features/portfolio/projection/model/plan-premises";
import type {
  PremiseFields,
  Premises,
  PremiseRanges,
} from "@/features/portfolio/projection/model/plan-premises";
import { outsideRange } from "@/features/portfolio/projection/model/outside-range";
import { numberFormatter } from "@/i18n/format";

type Plan = components["schemas"]["ProjectionPlan"];
type Change = components["schemas"]["ProjectionChange"];
type PlanInput = components["schemas"]["ProjectionPlanInput"];

export type WithdrawalMode = "income" | "rate";

// The plan section as typed: ages and rates stay text until they validate; income is minor units.
export interface PlanFields extends PremiseFields {
  withdrawalAge: string;
  lastAge: string;
  realReturn: string;
  inflation: string;
  mode: WithdrawalMode;
  income: number;
  rate: string;
}

// The fields as they validate: what every block below the plan section reads.
export interface ProjectionDraft extends Premises {
  withdrawalAge: number;
  lastAge: number;
  realReturnBp: number;
  inflationBp: number;
  withdrawal: Plan["withdrawal"];
  changes: Change[];
  incomes: OtherIncome[];
  currency: string;
}

// No figure is suggested (spec, anti-goals): a member without a plan starts from empty fields.
export const restFields: PlanFields = {
  withdrawalAge: "",
  lastAge: "",
  realReturn: "",
  inflation: "",
  mode: "income",
  income: 0,
  rate: "",
  withdrawalReturn: "",
  cautious: "",
  favorable: "",
  gainTax: "",
};

export function fieldsFromPlan(plan: Plan, locale: string): PlanFields {
  const percent = numberFormatter(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: false,
  });
  const optional = (bp: number | undefined) =>
    bp === undefined ? "" : percent.format(bp / 100);

  return {
    withdrawalAge: String(plan.withdrawal_age),
    lastAge: String(plan.last_age),
    realReturn: percent.format(plan.real_return_bp / 100),
    inflation: percent.format(plan.inflation_bp / 100),
    mode: plan.withdrawal.mode,
    income: plan.withdrawal.income ?? 0,
    rate: percent.format((plan.withdrawal.rate_bp ?? 0) / 100),
    withdrawalReturn: optional(plan.withdrawal_return_bp),
    cautious: optional(plan.cautious_return_bp),
    favorable: optional(plan.favorable_return_bp),
    gainTax: optional(plan.gain_tax_bp),
  };
}

// PJ1, PJ7: null while a field of the plan is empty, or any field is not a number or outside its range.
export function draftFrom(
  fields: PlanFields,
  changes: readonly Change[],
  incomes: readonly OtherIncome[],
  currency: string,
): ProjectionDraft | null {
  const withdrawalAge = parseAge(fields.withdrawalAge);
  const lastAge = parseAge(fields.lastAge);
  const realReturnBp = parseBasisPoints(fields.realReturn);
  const inflationBp = parseBasisPoints(fields.inflation);
  const rateBp = parseBasisPoints(fields.rate);

  if (withdrawalAge === null || withdrawalAge < 18 || withdrawalAge > 100)
    return null;
  if (lastAge === null || lastAge <= withdrawalAge || lastAge > 120)
    return null;
  if (realReturnBp === null || realReturnBp < -1000 || realReturnBp > 3000)
    return null;
  if (inflationBp === null || inflationBp < 0 || inflationBp > 5000)
    return null;

  const withdrawal = withdrawalFrom(fields, rateBp);
  const premises = premisesFrom(fields, realReturnBp);
  if (withdrawal === null || premises === null) return null;

  return {
    ...premises,
    withdrawalAge,
    lastAge,
    realReturnBp,
    inflationBp,
    withdrawal,
    changes: [...changes],
    incomes: [...incomes],
    currency,
  };
}

export function planInput(draft: ProjectionDraft): PlanInput {
  return {
    withdrawal_age: draft.withdrawalAge,
    last_age: draft.lastAge,
    real_return_bp: draft.realReturnBp,
    inflation_bp: draft.inflationBp,
    ...(draft.withdrawalReturnBp !== undefined && {
      withdrawal_return_bp: draft.withdrawalReturnBp,
    }),
    ...(draft.cautiousReturnBp !== undefined && {
      cautious_return_bp: draft.cautiousReturnBp,
    }),
    ...(draft.favorableReturnBp !== undefined && {
      favorable_return_bp: draft.favorableReturnBp,
    }),
    ...(draft.gainTaxBp !== undefined && { gain_tax_bp: draft.gainTaxBp }),
    withdrawal: draft.withdrawal,
    changes: draft.changes,
    incomes: draft.incomes,
  };
}

// The range a typed field left, per field; a field at rest (empty) and a field in its range have
// no entry. The section writes the range under the field, so a disabled save states its reason.
export type FieldRanges = PremiseRanges &
  Partial<
    Record<
      "withdrawalAge" | "lastAge" | "realReturn" | "inflation" | "rate",
      [min: number, max: number]
    >
  >;

export function fieldRanges(fields: PlanFields): FieldRanges {
  const withdrawalAge = parseAge(fields.withdrawalAge);
  const firstLast = Math.min(Math.max(withdrawalAge ?? 18, 18), 100) + 1;
  const ranges: FieldRanges = premiseRanges(
    fields,
    parseBasisPoints(fields.realReturn),
  );

  if (outsideRange(fields.withdrawalAge, withdrawalAge, 18, 100))
    ranges.withdrawalAge = [18, 100];
  if (outsideRange(fields.lastAge, parseAge(fields.lastAge), firstLast, 120))
    ranges.lastAge = [firstLast, 120];
  if (
    outsideRange(
      fields.realReturn,
      parseBasisPoints(fields.realReturn),
      -1000,
      3000,
    )
  )
    ranges.realReturn = [-10, 30];
  if (
    outsideRange(fields.inflation, parseBasisPoints(fields.inflation), 0, 5000)
  )
    ranges.inflation = [0, 50];
  if (
    fields.mode === "rate" &&
    outsideRange(fields.rate, parseBasisPoints(fields.rate), 1, 2000)
  )
    ranges.rate = [0.01, 20];

  return ranges;
}

function withdrawalFrom(
  fields: PlanFields,
  rateBp: number | null,
): Plan["withdrawal"] | null {
  if (fields.mode === "income")
    return fields.income > 0 ? { mode: "income", income: fields.income } : null;

  return rateBp !== null && rateBp >= 1 && rateBp <= 2000
    ? { mode: "rate", rate_bp: rateBp }
    : null;
}

export function parseAge(text: string): number | null {
  return /^\d{1,3}$/.test(text.trim()) ? Number(text) : null;
}
