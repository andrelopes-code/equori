import { recurringCost } from "@/features/calculators/model/plan-math";

export type Per = "month" | "year";

export type RecurringAnswer =
  | { kind: "missing" }
  | {
      kind: "solved";
      // Minor units: every payment over the years.
      total: number;
      // Minor units: the payments as deposits at the rate; null without a rate.
      futureValue: number | null;
      // Minor units: the future value less the total paid, by integer subtraction.
      difference: number | null;
    };

// Design §5, recurring-cost: the total of a recurring payment over the years and, with a rate,
// what the same payments would reach as deposits (M2).
export function recurringAnswer(input: {
  amount: number | null;
  per: Per;
  years: number | null;
  rate: number | null;
}): RecurringAnswer {
  const { amount, per, years, rate } = input;
  if (amount === null || years === null) return { kind: "missing" };

  const got = recurringCost(amount, per === "month" ? 12 : 1, years, rate);

  return {
    kind: "solved",
    total: got.total,
    futureValue: got.futureValue,
    difference: got.futureValue === null ? null : got.futureValue - got.total,
  };
}
