import {
  impliedRate,
  presentValue,
} from "@/features/calculators/model/credit-math";

export interface CashAnswer {
  // Minor units: the installments added up.
  total: number;
  // The monthly rate the installments imply over the cash price.
  implied: number | "no_interest" | null;
  // Null while there is no comparison rate.
  comparison: {
    // Minor units.
    presentValue: number;
    // Minor units, never negative.
    difference: number;
    cheaper: "cash" | "installments" | "equal";
  } | null;
}

// Null while the cash price, the count or the installment is missing. The difference is the
// integer subtraction of the present value and the cash price.
export function cashAnswer(input: {
  cash: number | null;
  count: number | null;
  installment: number | null;
  firstNow: boolean;
  compareMonthly: number | null;
}): CashAnswer | null {
  const { cash, count, installment, firstNow, compareMonthly } = input;
  if (cash === null || cash <= 0 || count === null || installment === null)
    return null;

  const total = count * installment;
  const implied = impliedRate(cash, count, installment, firstNow);
  if (compareMonthly === null) return { total, implied, comparison: null };

  const value = presentValue(count, installment, compareMonthly, firstNow);
  const delta = value - cash;
  let cheaper: "cash" | "installments" | "equal" = "equal";
  if (delta > 0) cheaper = "cash";
  if (delta < 0) cheaper = "installments";

  return {
    total,
    implied,
    comparison: { presentValue: value, difference: Math.abs(delta), cheaper },
  };
}
