import {
  depositsValue,
  futureValue,
  monthlyIncome,
  splitIncome,
} from "@/features/calculators/model/compound-math";
import { annualToMonthly } from "@/features/calculators/model/rate-math";
import { roundHalfEven } from "@/features/calculators/model/round";

interface AccumulationInput {
  initial: number;
  deposit: number;
  // A monthly rate as a fraction.
  j: number;
  months: number;
  // A yearly rate as a fraction; null without one.
  inflation: number | null;
  // Months the deposits start later; null without a delay.
  delay: number | null;
}

interface AccumulationResult {
  final: number;
  deposited: number;
  // The final amount in today's money; null without an inflation.
  today: number | null;
  // The final amount when the deposits start later; null without a delay.
  delayed: number | null;
}

interface TermIncomeInput {
  final: number;
  j: number;
  inflation: number | null;
  months: number;
  // Months the balance is spent over; null keeps the balance.
  withdraw: number | null;
}

interface TermIncome {
  // The income that keeps the balance; null when inflation reaches the return.
  lasting: {
    today: number;
    atEnd: number;
    reinvested: number;
    living: number;
  } | null;
  // The income that spends the balance over the withdrawal term, in today's money.
  spending: number | null;
}

interface LivingIncomeInput {
  // The balance in today's money.
  balance: number;
  j: number;
  inflation: number | null;
  months: number;
  // The share of the income reinvested, as a fraction.
  share: number;
}

interface SplitRowInput {
  name: string;
  deposited: number;
  final: number;
  format: (minor: number) => string;
  depositedLabel: string;
  interestLabel: string;
}

// Amounts are minor units; the cost is an integer subtraction (web O7).
export function waitingCost(final: number, delayed: number): number {
  return final - delayed;
}

// The 10th, 50th and 90th percentile of a simulation as the low, mid and high of a range.
export function rangeOf(simulation: {
  p10: number;
  p50: number;
  p90: number;
}): {
  low: number;
  mid: number;
  high: number;
} {
  return { low: simulation.p10, mid: simulation.p50, high: simulation.p90 };
}

// An income of today's money in the money of the term's end, with a yearly inflation.
export function incomeAtEnd(
  income: number,
  inflation: number | null,
  months: number,
): number {
  if (inflation === null) return income;

  return roundHalfEven(income * (1 + inflation) ** (months / 12));
}

export function accumulationResult(
  input: AccumulationInput,
): AccumulationResult {
  const { initial, deposit, j, months, inflation, delay } = input;
  const grow = (term: number) =>
    futureValue(initial, j, term) + depositsValue(deposit, j, term);
  const final = grow(months);

  return {
    final,
    deposited: initial + deposit * months,
    today:
      inflation === null
        ? null
        : roundHalfEven(final / (1 + inflation) ** (months / 12)),
    delayed: delay === null ? null : grow(Math.max(months - delay, 0)),
  };
}

// The monthly income of a final amount from the month after the term, in today's money and in
// the money of the term's end (design §5, compound).
export function termIncome(input: TermIncomeInput): TermIncome {
  const { final, j, inflation, months, withdraw } = input;
  const g = inflation === null ? 0 : annualToMonthly(inflation);
  const today = (value: number) =>
    inflation === null
      ? value
      : roundHalfEven(value / (1 + inflation) ** (months / 12));
  const lasting = monthlyIncome(final, j, g);
  const spending =
    withdraw === null ? null : monthlyIncome(final, j, g, withdraw);

  return {
    lasting:
      lasting === null
        ? null
        : {
            today: today(lasting),
            atEnd: lasting,
            ...splitIncome(today(lasting)),
          },
    spending: spending === null ? null : today(spending),
  };
}

// The monthly income that keeps the purchasing power of a balance of today: in today's money, in
// the money of the term's end, and split in the reinvested and the living parts. null when
// inflation reaches the return.
export function livingIncome(input: LivingIncomeInput): TermIncome["lasting"] {
  const g = input.inflation === null ? 0 : annualToMonthly(input.inflation);
  const today = monthlyIncome(input.balance, input.j, g);

  if (today === null) return null;

  return {
    today,
    atEnd: incomeAtEnd(today, input.inflation, input.months),
    ...splitIncome(today, input.share),
  };
}

// One bar: what was deposited and the interest on it, the final amount at the end, and the
// accessible name with both values.
export function splitRow(input: SplitRowInput) {
  const interest = input.final - input.deposited;
  const total = input.format(input.final);

  return {
    name: input.name,
    parts: [input.deposited, interest] as [number, number],
    total,
    label: `${input.name}: ${input.depositedLabel} ${input.format(input.deposited)}, ${input.interestLabel} ${input.format(interest)}`,
  };
}
