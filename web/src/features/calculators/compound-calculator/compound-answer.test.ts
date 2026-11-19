import { describe, expect, it } from "vitest";

import {
  accumulationResult,
  incomeAtEnd,
  livingIncome,
  rangeOf,
  splitRow,
  termIncome,
  waitingCost,
} from "@/features/calculators/compound-calculator/compound-answer";
import { annualToMonthly } from "@/features/calculators/model/rate-math";

describe("waitingCost", () => {
  it.each([
    {
      name: "a delay costs the difference",
      final: 22739502,
      delayed: 19523136,
      cost: 3216366,
    },
    { name: "no delay costs nothing", final: 5000, delayed: 5000, cost: 0 },
  ])("$name", ({ final, delayed, cost }) => {
    expect(waitingCost(final, delayed)).toBe(cost);
  });
});

describe("rangeOf", () => {
  it("maps the percentiles 10, 50 and 90 to low, mid and high", () => {
    expect(rangeOf({ p10: 15675236, p50: 21882263, p90: 30392674 })).toEqual({
      low: 15675236,
      mid: 21882263,
      high: 30392674,
    });
  });
});

describe("incomeAtEnd", () => {
  it.each([
    {
      name: "no inflation keeps the income",
      income: 1000,
      inflation: null,
      months: 24,
      atEnd: 1000,
    },
    {
      name: "a year of 4%",
      income: 1000,
      inflation: 0.04,
      months: 12,
      atEnd: 1040,
    },
    {
      name: "two years of 10%",
      income: 1000,
      inflation: 0.1,
      months: 24,
      atEnd: 1210,
    },
  ])("$name", ({ income, inflation, months, atEnd }) => {
    expect(incomeAtEnd(income, inflation, months)).toBe(atEnd);
  });
});

describe("termIncome", () => {
  const base = {
    final: 112683,
    j: 0.01,
    inflation: null,
    months: 12,
    withdraw: null,
  };

  it("keeps the assets and splits the income, without inflation", () => {
    expect(termIncome(base)).toEqual({
      lasting: { today: 1127, atEnd: 1127, reinvested: 282, living: 845 },
      spending: null,
    });
  });

  it("states the income in today's money and at the term's end, with a withdrawal term", () => {
    const income = termIncome({ ...base, inflation: 0.04, withdraw: 120 });

    expect(income.lasting?.atEnd).toBe(758);
    expect(income.lasting?.today).toBe(729);
    expect(income.spending).toBe(1321);
  });

  it("has no lasting income when inflation reaches the return", () => {
    const income = termIncome({
      ...base,
      j: 0.002,
      inflation: 0.04,
      withdraw: 120,
    });

    expect(income.lasting).toBeNull();
    expect(income.spending).not.toBeNull();
  });
});

describe("splitRow", () => {
  it("splits the final amount in what was deposited and its interest", () => {
    const row = splitRow({
      name: "Final",
      deposited: 13000000,
      final: 22739502,
      format: (minor) => `$${String(minor)}`,
      depositedLabel: "Deposited",
      interestLabel: "Interest",
    });

    expect(row).toEqual({
      name: "Final",
      parts: [13000000, 9739502],
      total: "$22739502",
      label: "Final: Deposited $13000000, Interest $9739502",
    });
  });
});

describe("accumulationResult", () => {
  const base = {
    initial: 1000000,
    deposit: 100000,
    j: annualToMonthly(0.1),
    months: 120,
    inflation: null,
    delay: null,
  };

  it("adds the deposits to the grown initial amount", () => {
    const result = accumulationResult(base);

    expect(result.final).toBe(22739502);
    expect(result.deposited).toBe(13000000);
    expect(result.today).toBeNull();
    expect(result.delayed).toBeNull();
  });

  it("states the amount in today's money and when the deposits start later", () => {
    const result = accumulationResult({ ...base, inflation: 0.045, delay: 12 });

    expect(result.today).toBe(14642595);
    expect(result.delayed).toBe(19523136);
  });

  it("does not grow for a delay that reaches the term", () => {
    expect(accumulationResult({ ...base, delay: 200 }).delayed).toBe(1000000);
  });
});

describe("livingIncome", () => {
  const base = {
    balance: 100000000,
    j: 0.01,
    inflation: null,
    months: 12,
    share: 0.25,
  };

  it("pays the return of the balance and splits it by the reinvested share", () => {
    expect(livingIncome(base)).toEqual({
      today: 1000000,
      atEnd: 1000000,
      reinvested: 250000,
      living: 750000,
    });
  });

  it("states the same income in the money of the term's end", () => {
    const income = livingIncome({ ...base, inflation: 0.04 });

    expect(income?.atEnd).toBe(incomeAtEnd(income?.today ?? 0, 0.04, 12));
    expect(income?.today).toBeLessThan(1000000);
    expect(income?.atEnd).toBeGreaterThan(income?.today ?? 0);
  });

  it("has no income when inflation reaches the return", () => {
    expect(livingIncome({ ...base, inflation: 0.2 })).toBeNull();
  });
});
