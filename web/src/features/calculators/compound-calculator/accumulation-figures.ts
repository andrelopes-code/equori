import {
  depositsValue,
  futureValue,
} from "@/features/calculators/model/compound-math";
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

interface FactsInput {
  target: boolean;
  deposited: number;
  final: number;
  today: number | null;
  delayed: number | null;
  format: (minor: number) => string;
  labels: {
    deposited: string;
    interest: string;
    today: string;
    // Already names the delay.
    delayed: string;
    wait: string;
  };
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

// The facts under the figure, at most three: for a target the deposited amount and the interest,
// then today's money, the delayed amount and the cost of waiting.
export function accumulationFacts(
  input: FactsInput,
): { term: string; value: string }[] {
  const { format, labels } = input;
  const facts = [
    ...(input.target
      ? [
          { term: labels.deposited, value: format(input.deposited) },
          {
            term: labels.interest,
            value: format(input.final - input.deposited),
          },
        ]
      : []),
    ...(input.today === null
      ? []
      : [{ term: labels.today, value: format(input.today) }]),
    ...(input.delayed === null
      ? []
      : [
          { term: labels.delayed, value: format(input.delayed) },
          {
            term: labels.wait,
            value: format(waitingCost(input.final, input.delayed)),
          },
        ]),
  ];

  return facts.slice(0, 3);
}
