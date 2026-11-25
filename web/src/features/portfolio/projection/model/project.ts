import type { components } from "@/api/schema.gen";
import { contributionIn } from "@/features/portfolio/projection/model/contribution-in";

export interface ProjectionRow {
  month: string;
  contribution: number;
  withdrawal: number;
  gain: number;
  value: number;
}

export interface ProjectInput {
  start: number;
  monthlyRate: number;
  months: readonly string[];
  changes: readonly components["schemas"]["ProjectionChange"][];
  withdrawalFrom: string;
  income: number;
}

// PX4: one row per month, `v = v * (1 + r) + contribution - withdrawal`; contributions stop and
// withdrawals start at `withdrawalFrom`, and a value that would fall below zero is zero.
export function project(input: ProjectInput): ProjectionRow[] {
  let value = input.start;

  return input.months.map((month) => {
    const withdrawing = month >= input.withdrawalFrom;
    const contribution = withdrawing ? 0 : contributionIn(input.changes, month);
    const gain = value * input.monthlyRate;
    const available = value + gain + contribution;
    const withdrawal = withdrawing
      ? Math.min(input.income, Math.max(available, 0))
      : 0;
    value = available - withdrawal;

    return { month, contribution, withdrawal, gain, value };
  });
}
