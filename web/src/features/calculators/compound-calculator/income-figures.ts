import {
  futureValue,
  monthlyIncome,
  splitIncome,
} from "@/features/calculators/model/compound-math";
import type { IncomeRow } from "@/features/calculators/model/compound-math";
import { annualToMonthly } from "@/features/calculators/model/rate-math";
import { roundHalfEven } from "@/features/calculators/model/round";

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
  // The monthly return net of inflation, by the Fisher relation: it compounds the delay.
  net: number;
  // The rate of the lasting income, j - g: the income is balance × lasting (method formula7).
  lasting: number;
  months: number;
  share: number;
  // The delay and the months of income, up to the term's end.
  term: number;
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

// The monthly return net of the monthly inflation, by the Fisher relation: the rate at which a
// balance compounds in today's money. The lasting income does not use it: W = F (j - g).
export function realMonthlyRate(j: number, inflation: number | null): number {
  return inflation === null
    ? j
    : (1 + j) / (1 + annualToMonthly(inflation)) - 1;
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

// The inputs of the income mode once every one is valid and the return beats inflation; null
// otherwise.
export function incomeSetup(input: IncomeSetupInput): IncomeSetup | null {
  const { balance, j, months, share } = input;

  if (balance === null || balance <= 0 || j === null) return null;
  if (months === null || share === null) return null;

  const net = realMonthlyRate(j, input.inflation);
  if (net <= 0) return null;

  const g = input.inflation === null ? 0 : annualToMonthly(input.inflation);

  return {
    balance: delayedBalance(balance, net, input.delay),
    j,
    net,
    lasting: j - g,
    months,
    share,
    term: months + (input.delay ?? 0),
  };
}
