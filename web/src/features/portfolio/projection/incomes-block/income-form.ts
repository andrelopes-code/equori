import type { OtherIncome } from "@/features/portfolio/projection/model/other-income";
import { parseAge } from "@/features/portfolio/projection/model/plan-fields";

// The dialog as typed: the ages stay text until they validate; the amount is minor units.
export interface IncomeForm {
  name: string;
  amount: number;
  startAge: string;
  endAge: string;
}

export interface IncomeErrors {
  name?: true;
  amount?: true;
  startAge?: [min: number, max: number];
  endAge?: [min: number, max: number];
}

// PJ8: what keeps the form from being an income; an empty end age is an income that does not end.
export function incomeErrors(form: IncomeForm): IncomeErrors {
  const errors: IncomeErrors = {};
  const start = parseAge(form.startAge);
  const startValid = start !== null && start >= 18 && start <= 120;
  const firstEnd = startValid ? Math.min(start + 1, 120) : 19;

  if (form.name.trim() === "") errors.name = true;
  if (form.amount <= 0) errors.amount = true;
  if (!startValid) errors.startAge = [18, 120];
  if (form.endAge.trim() === "") return errors;

  const end = parseAge(form.endAge);
  const afterStart = !startValid || (end !== null && end > start);
  if (end === null || end < firstEnd || end > 120 || !afterStart)
    errors.endAge = [firstEnd, 120];

  return errors;
}

// The income of a form without errors.
export function incomeOf(form: IncomeForm): OtherIncome {
  const end = parseAge(form.endAge);

  return {
    name: form.name.trim(),
    amount: form.amount,
    start_age: parseAge(form.startAge) ?? 0,
    ...(end !== null && { end_age: end }),
  };
}

export function formOf(income: OtherIncome | null): IncomeForm {
  return {
    name: income?.name ?? "",
    amount: income?.amount ?? 0,
    startAge: income === null ? "" : String(income.start_age),
    endAge: income?.end_age === undefined ? "" : String(income.end_age),
  };
}
