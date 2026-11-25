import type { components } from "@/api/schema.gen";

export type OtherIncome = components["schemas"]["ProjectionIncome"];

// PX4: the sum of the other incomes in force in a month (`YYYY-MM`): each from the birth month of
// its start age to the month before the birth month of its end age.
export function otherIncomeIn(
  incomes: readonly OtherIncome[],
  birthDate: string,
  month: string,
): number {
  const age = (monthNumber(month) - monthNumber(birthDate)) / 12;

  return incomes
    .filter((i) => i.start_age <= age && age < (i.end_age ?? Infinity))
    .reduce((sum, i) => sum + i.amount, 0);
}

function monthNumber(date: string): number {
  return Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7));
}
