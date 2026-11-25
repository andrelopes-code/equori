import type { components } from "@/api/schema.gen";
import { numberFormatter } from "@/i18n/format";

type Plan = components["schemas"]["ProjectionPlan"];
type Change = components["schemas"]["ProjectionChange"];
type PlanInput = components["schemas"]["ProjectionPlanInput"];

export type WithdrawalMode = "income" | "rate";

// The plan section as typed: ages and rates stay text until they validate; income is minor units.
export interface PlanFields {
  withdrawalAge: string;
  lastAge: string;
  realReturn: string;
  inflation: string;
  mode: WithdrawalMode;
  income: number;
  rate: string;
}

// The fields as they validate: what every block below the plan section reads.
export interface ProjectionDraft {
  withdrawalAge: number;
  lastAge: number;
  realReturnBp: number;
  inflationBp: number;
  withdrawal: Plan["withdrawal"];
  changes: Change[];
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
};

export function fieldsFromPlan(plan: Plan, locale: string): PlanFields {
  const percent = numberFormatter(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: false,
  });

  return {
    withdrawalAge: String(plan.withdrawal_age),
    lastAge: String(plan.last_age),
    realReturn: percent.format(plan.real_return_bp / 100),
    inflation: percent.format(plan.inflation_bp / 100),
    mode: plan.withdrawal.mode,
    income: plan.withdrawal.income ?? 0,
    rate: percent.format((plan.withdrawal.rate_bp ?? 0) / 100),
  };
}

// PJ1: null while a field is empty, not a number or outside its range.
export function draftFrom(
  fields: PlanFields,
  changes: readonly Change[],
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
  if (withdrawal === null) return null;

  return {
    withdrawalAge,
    lastAge,
    realReturnBp,
    inflationBp,
    withdrawal,
    changes: [...changes],
    currency,
  };
}

export function planInput(draft: ProjectionDraft): PlanInput {
  return {
    withdrawal_age: draft.withdrawalAge,
    last_age: draft.lastAge,
    real_return_bp: draft.realReturnBp,
    inflation_bp: draft.inflationBp,
    withdrawal: draft.withdrawal,
    changes: draft.changes,
  };
}

// The withdrawal age at or below the current age leaves nothing to project.
export function startsTooEarly(
  fields: PlanFields,
  age: number | null,
): boolean {
  const withdrawalAge = parseAge(fields.withdrawalAge);

  return withdrawalAge !== null && age !== null && withdrawalAge <= age;
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

function parseAge(text: string): number | null {
  return /^\d{1,3}$/.test(text.trim()) ? Number(text) : null;
}

// A percent typed with a comma or a dot, in basis points.
function parseBasisPoints(text: string): number | null {
  const dotted = text.trim().replace("\u2212", "-").replace(",", ".");

  return /^-?\d+(\.\d+)?$/.test(dotted)
    ? Math.round(Number(dotted) * 100)
    : null;
}
