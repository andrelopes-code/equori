import { describe, expect, it } from "vitest";

import type { IndicatorMonth, Indicators } from "@/features/overview";
import { ledger, verdict } from "@/features/reports/indicator-verdict";

describe("verdict", () => {
  it.each([
    {
      name: "below the mean",
      last: { savings_rate: { bp: 800 }, trailing_savings_rate: { bp: 1200 } },
      incomplete: false,
      want: { kind: "below", rate: 800, mean: 1200, delta: 400 },
    },
    {
      name: "above the mean",
      last: {
        savings_rate: { bp: 1500 },
        trailing_savings_rate: { bp: 1200 },
      },
      incomplete: false,
      want: { kind: "above", rate: 1500, mean: 1200, delta: 300 },
    },
    {
      name: "equal to the mean",
      last: {
        savings_rate: { bp: 1200 },
        trailing_savings_rate: { bp: 1200 },
      },
      incomplete: false,
      want: { kind: "inline", rate: 1200, mean: 1200 },
    },
    {
      name: "no mean yet",
      last: {
        savings_rate: { bp: 800 },
        trailing_savings_rate: { reason: "insufficient_history" },
      },
      incomplete: false,
      want: { kind: "noMean", rate: 800 },
    },
    {
      name: "no income",
      last: { savings_rate: { reason: "no_income" } },
      incomplete: false,
      want: { kind: "noIncome" },
    },
    {
      name: "incomplete month",
      last: { savings_rate: { bp: -17241 } },
      incomplete: true,
      want: { kind: "partial", rate: -17241 },
    },
  ] satisfies {
    name: string;
    last: Partial<IndicatorMonth>;
    incomplete: boolean;
    want: ReturnType<typeof verdict>;
  }[])("$name", ({ last, incomplete, want }) => {
    expect(verdict(report(last), incomplete)).toEqual(want);
  });
});

describe("ledger", () => {
  it.each([
    {
      income: 100000,
      expense: 80000,
      want: { income: 100000, expense: 80000, result: 20000 },
    },
    {
      income: 40000,
      expense: 70000,
      want: { income: 40000, expense: 70000, result: -30000 },
    },
  ])("income $income and expense $expense", ({ income, expense, want }) => {
    const last = { income: brl(income), expense: brl(expense) };

    expect(ledger(report(last))).toEqual(want);
  });
});

function report(last: Partial<IndicatorMonth>): Indicators {
  const month: IndicatorMonth = {
    month: "2026-10",
    income: brl(0),
    expense: brl(0),
    committed: brl(0),
    debt_service: brl(0),
    liquid_balance: brl(0),
    liabilities: brl(0),
    savings_rate: { bp: 0 },
    trailing_savings_rate: { bp: 0 },
    liquidity: { bp: 0 },
    committed_share: { bp: 0 },
    debt_service_share: { bp: 0 },
  };

  return { currency: "BRL", months: [{ ...month, ...last }] };
}

function brl(amount: number) {
  return { amount, currency: "BRL" };
}
