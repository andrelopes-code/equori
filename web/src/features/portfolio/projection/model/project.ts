import type { components } from "@/api/schema.gen";
import { contributionIn } from "@/features/portfolio/projection/model/contribution-in";
import {
  gainShare,
  grossOf,
} from "@/features/portfolio/projection/model/gain-tax";
import type { GainTax } from "@/features/portfolio/projection/model/gain-tax";

export interface ProjectionRow {
  month: string;
  contribution: number;
  // What leaves the portfolio: the gross of the income while a tax holds.
  withdrawal: number;
  gain: number;
  value: number;
}

export interface ProjectInput {
  start: number;
  monthlyRate: number;
  // The monthly rate from `withdrawalFrom` on; absent, `monthlyRate` holds.
  withdrawalRate?: number | undefined;
  months: readonly string[];
  changes: readonly components["schemas"]["ProjectionChange"][];
  withdrawalFrom: string;
  income: number;
  // PX4: the other incomes of a month; the portfolio pays the rest of the income.
  others?: ((month: string) => number) | undefined;
  tax?: GainTax | undefined;
}

// PX4, PX14: one row per month, `v = v * (1 + r) + contribution - withdrawal`; contributions stop and
// withdrawals start at `withdrawalFrom`, and a value that would fall below zero is zero.
export function project(input: ProjectInput): ProjectionRow[] {
  const { tax, monthlyRate, withdrawalRate = monthlyRate } = input;
  let value = input.start;
  let basis = tax?.basis ?? 0;

  return input.months.map((month) => {
    const withdrawing = month >= input.withdrawalFrom;
    const contribution = withdrawing ? 0 : contributionIn(input.changes, month);
    const gain = value * (withdrawing ? withdrawalRate : monthlyRate);
    const available = Math.max(value + gain + contribution, 0);
    basis = basis / (1 + (tax?.inflation ?? 0)) + contribution;

    const gross = grossOf(
      Math.max(input.income - (input.others?.(month) ?? 0), 0),
      tax === undefined ? 0 : gainShare(available, basis),
      tax?.rate ?? 0,
    );
    const withdrawal = withdrawing ? Math.min(gross, available) : 0;
    basis *= available === 0 ? 0 : 1 - withdrawal / available;
    value = available - withdrawal;

    return { month, contribution, withdrawal, gain, value };
  });
}
