import {
  depositsValue,
  futureValue,
  monthlyIncome,
  splitIncome,
} from "@/features/calculators/model/compound-math";
import type { IncomeRow } from "@/features/calculators/model/compound-math";
import { missingSentence } from "@/features/calculators/calculator-frame/missing-fields";
import { rateText } from "@/features/calculators/model/format-rate";
import { annualToMonthly } from "@/features/calculators/model/rate-math";
import { roundHalfEven } from "@/features/calculators/model/round";
import type { TFunction } from "@/i18n/i18n-provider";

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

interface TermIncomeRowsInput {
  income: TermIncome;
  // An inflation is set: the rows carry the money they are in.
  inflation: boolean;
  format: (minor: number) => string;
  labels: {
    lasting: string;
    same: string;
    atEnd: string;
    today: string;
    reinvest: string;
    living: string;
    spending: string;
  };
}

interface EmptySentenceInput<K extends string> {
  // The inputs in reading order.
  order: readonly K[];
  labels: Record<K, string>;
  missing: Record<K, boolean>;
  // What the answer will show, after "to see".
  what: string;
  t: TFunction;
  tag: string;
}

interface IncomeSetupInput {
  balance: number | null;
  // A monthly rate as a fraction.
  j: number | null;
  inflation: number | null;
  months: number | null;
  // The share of the income reinvested, as a fraction.
  share: number | null;
  // Months the balance compounds before the income starts; null without a delay.
  delay: number | null;
}

interface IncomeSetup {
  // The balance when the income starts, in today's money.
  balance: number;
  j: number;
  // The monthly return net of inflation.
  net: number;
  months: number;
  share: number;
  // The delay and the months of income, up to the term's end.
  term: number;
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

// The labelled rows of the income after the term; a note names the money when an inflation is set.
export function termIncomeRows(
  input: TermIncomeRowsInput,
): { term: string; note?: string; value: string }[] {
  const { income, format, labels } = input;
  const note = input.inflation ? { note: labels.today } : {};
  const { lasting, spending } = income;

  return [
    ...(lasting === null
      ? []
      : [
          { term: labels.lasting, ...note, value: format(lasting.today) },
          ...(input.inflation
            ? [
                {
                  term: labels.same,
                  note: labels.atEnd,
                  value: format(lasting.atEnd),
                },
              ]
            : []),
          { term: labels.reinvest, ...note, value: format(lasting.reinvested) },
          { term: labels.living, ...note, value: format(lasting.living) },
        ]),
    ...(spending === null
      ? []
      : [{ term: labels.spending, ...note, value: format(spending) }]),
  ];
}

// The sentence of an answer without a figure: the inputs still missing, in reading order; empty
// when none is missing.
export function emptySentence<K extends string>(
  input: EmptySentenceInput<K>,
): string {
  const fields = input.order.map((key) => ({
    label: input.labels[key].toLocaleLowerCase(input.tag),
    missing: input.missing[key],
  }));

  return missingSentence(fields, input.what, input.t, input.tag) ?? "";
}

// The monthly return net of the monthly inflation: the rate at which a balance keeps its purchasing
// power, so its income agrees with livingIncome.
export function realMonthlyRate(j: number, inflation: number | null): number {
  return inflation === null ? j : j - annualToMonthly(inflation);
}

// The monthly income that spends a balance of today over a withdrawal term, in today's money.
export function balanceSpending(input: {
  balance: number;
  j: number;
  inflation: number | null;
  withdraw: number;
}): number | null {
  const g = input.inflation === null ? 0 : annualToMonthly(input.inflation);

  return monthlyIncome(input.balance, input.j, g, input.withdraw);
}

// The text of a rate field: what is typed, or the rate an index fills in (empty while it loads).
export function rateFieldValue(
  typed: string | undefined,
  indexed: boolean,
  fromIndex: { rate: number } | null,
): string {
  if (!indexed) return typed ?? "";

  return fromIndex === null ? "" : rateText(fromIndex.rate);
}

// The balance when the income starts: the balance compounds at the net monthly rate through the
// delay without any withdrawal.
export function delayedBalance(
  balance: number,
  net: number,
  delay: number | null,
): number {
  return delay === null ? balance : futureValue(balance, net, delay);
}

// What the months of living on the income paid out in total.
export function incomeTotals(rows: readonly IncomeRow[]): {
  living: number;
  reinvested: number;
} {
  return {
    living: rows.reduce((sum, row) => sum + row.living, 0),
    reinvested: rows.reduce((sum, row) => sum + row.reinvested, 0),
  };
}

// A rate typed per month or per year as a monthly fraction; null without a rate.
export function monthlyRate(
  typed: number | null,
  period: "month" | "year",
): number | null {
  if (typed === null) return null;

  return period === "month" ? typed : annualToMonthly(typed);
}

// The inputs of the income mode once every one is valid and the return beats inflation; null
// otherwise.
export function incomeSetup(input: IncomeSetupInput): IncomeSetup | null {
  const { balance, j, months, share } = input;

  if (balance === null || balance <= 0 || j === null) return null;
  if (months === null || share === null) return null;

  const net = realMonthlyRate(j, input.inflation);
  if (net <= 0) return null;

  return {
    balance: delayedBalance(balance, net, input.delay),
    j,
    net,
    months,
    share,
    term: months + (input.delay ?? 0),
  };
}
