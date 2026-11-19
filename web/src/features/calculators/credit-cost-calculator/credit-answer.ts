import {
  effectiveAnnualCost,
  monthlyDates,
} from "@/features/calculators/model/credit-math";
import { annualToMonthly } from "@/features/calculators/model/rate-math";
import { roundHalfEven } from "@/features/calculators/model/round";

export interface CreditFlow {
  date: string;
  // Whole days from the release date.
  days: number;
  // Minor units.
  amount: number;
}

export type CreditAnswer =
  | { kind: "missing" }
  // The first due date does not come after the release date.
  | { kind: "order" }
  // No annual cost from -99% to 10,000% makes the flows equal the amount released less the fees.
  | { kind: "no_solution" }
  | {
      kind: "solved";
      // The annual cost, rounded to 4 decimals.
      annual: number;
      // The monthly rate equivalent to the annual cost.
      monthly: number;
      // Minor units: the fees and every installment.
      paid: number;
      // Minor units: the total paid less the amount released, by integer subtraction.
      cost: number;
      flows: CreditFlow[];
    };

// Design §5, credit-cost: the annual rate at which the installments of an offer, each discounted
// by its days from the release, equal the amount released less the fees paid upfront
// (CMN 4.881, art. 4). The order of the dates is checked first, as the screen always did.
export function creditAnswer(input: {
  released: number | null;
  fees: number;
  installment: number | null;
  count: number | null;
  releaseDate: string;
  firstDue: string | null;
}): CreditAnswer {
  const { released, fees, installment, count, releaseDate, firstDue } = input;
  if (firstDue !== null && firstDue <= releaseDate) return { kind: "order" };
  if (
    released === null ||
    installment === null ||
    count === null ||
    firstDue === null
  )
    return { kind: "missing" };

  const dates = monthlyDates(firstDue, count);
  const cost = effectiveAnnualCost(
    released,
    fees,
    releaseDate,
    dates.map((date) => ({ date, amount: installment })),
  );
  if (cost === null) return { kind: "no_solution" };

  const annual = roundHalfEven(cost * 10000) / 10000;
  const paid = fees + installment * count;

  return {
    kind: "solved",
    annual,
    monthly: annualToMonthly(annual),
    paid,
    cost: paid - released,
    flows: dates.map((date) => ({
      date,
      days: daysBetween(releaseDate, date),
      amount: installment,
    })),
  };
}

function daysBetween(from: string, to: string): number {
  return (
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
    86_400_000
  );
}
