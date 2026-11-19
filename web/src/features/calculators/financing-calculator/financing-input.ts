import { choices } from "@/features/calculators/financing-calculator/address-keys";
import { solvePrice } from "@/features/calculators/financing-calculator/annuity";
import {
  readMinor,
  readRate,
} from "@/features/calculators/model/calculator-search";
import { readMonths, readUnit } from "@/features/calculators/model/duration";
import { annualToMonthly } from "@/features/calculators/model/rate-math";

export type Solve = (typeof choices.solve)[number];

export const solves = choices.solve;

export const maxMonths = 1200;

export type Field = "amount" | "rate" | "months" | "installment";

// Reading order of the four figures; the missing-inputs sentence names them in it.
export const fieldOrder: readonly Field[] = [
  "amount",
  "rate",
  "months",
  "installment",
];

// The four figures of a loan read from the address, and the one that is solved. A figure that is
// absent, invalid, or zero where it must be above zero counts as missing.
export function readFinancing(search: Record<string, string | undefined>) {
  const monthsUnit = readUnit(search.monthsUnit, choices.monthsUnit);
  const solve: Solve =
    choices.solve.find((s) => s === search.solve) ?? "installment";
  const period = search.period === "month" ? "month" : "year";
  const rate = readRate(search.rate);
  const monthly =
    rate === null || rate < 0
      ? null
      : period === "month"
        ? rate
        : annualToMonthly(rate);
  const given = {
    amount: readMinor(search.amount) ?? undefined,
    rate: monthly ?? undefined,
    months: readMonths(search.months, monthsUnit, 1, maxMonths) ?? undefined,
    installment: readMinor(search.installment) ?? undefined,
  };
  const missing = Object.fromEntries(
    fieldOrder.map((field) => [
      field,
      field !== solve &&
        (given[field] === undefined ||
          ((field === "amount" || field === "installment") &&
            given[field] === 0)),
    ]),
  ) as Record<Field, boolean>;
  const known = { ...given, [solve]: undefined };
  const complete = !fieldOrder.some((field) => missing[field]);

  return {
    solve,
    period,
    monthsUnit,
    missing,
    complete,
    solved: complete ? solvePrice(known) : null,
  };
}
