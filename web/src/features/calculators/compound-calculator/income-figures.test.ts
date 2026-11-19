import { describe, expect, it } from "vitest";

import {
  balanceSpending,
  delayedBalance,
  incomeAtEnd,
  incomeSetup,
  incomeTotals,
  livingIncome,
  realMonthlyRate,
  termIncome,
  termIncomeRows,
} from "@/features/calculators/compound-calculator/income-figures";
import { annualToMonthly } from "@/features/calculators/model/rate-math";

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

describe("termIncomeRows", () => {
  const labels = {
    lasting: "Lasting",
    same: "Same",
    atEnd: "At end",
    today: "Today",
    reinvest: "Reinvest",
    living: "Living",
    spending: "Spending",
  };
  const format = (minor: number) => `$${String(minor)}`;
  const lasting = { today: 729, atEnd: 758, reinvested: 182, living: 547 };

  it("notes the money of each row and adds the income at the end when an inflation is set", () => {
    expect(
      termIncomeRows({
        income: { lasting, spending: 1321 },
        inflation: true,
        format,
        labels,
      }),
    ).toEqual([
      { term: "Lasting", note: "Today", value: "$729" },
      { term: "Same", note: "At end", value: "$758" },
      { term: "Reinvest", note: "Today", value: "$182" },
      { term: "Living", note: "Today", value: "$547" },
      { term: "Spending", note: "Today", value: "$1321" },
    ]);
  });

  it("writes no note and no income at the end without an inflation", () => {
    expect(
      termIncomeRows({
        income: { lasting, spending: null },
        inflation: false,
        format,
        labels,
      }),
    ).toEqual([
      { term: "Lasting", value: "$729" },
      { term: "Reinvest", value: "$182" },
      { term: "Living", value: "$547" },
    ]);
  });

  it("holds only the spending income when no income keeps the assets", () => {
    expect(
      termIncomeRows({
        income: { lasting: null, spending: 1321 },
        inflation: false,
        format,
        labels,
      }),
    ).toEqual([{ term: "Spending", value: "$1321" }]);
  });
});

describe("realMonthlyRate", () => {
  it("keeps the rate without an inflation", () => {
    expect(realMonthlyRate(0.01, null)).toBe(0.01);
  });

  // M3, the Fisher relation: g = 1.04^(1/12) - 1 = 0.0032737398 (annualToMonthly(0.04)), so
  // 1.01 / 1.0032737398 - 1 = 0.0067043120. The subtraction 0.01 - g = 0.0067262602 was above it.
  it("divides the monthly return by the monthly inflation", () => {
    const g = annualToMonthly(0.04);

    expect(realMonthlyRate(0.01, 0.04)).toBeCloseTo(1.01 / (1 + g) - 1, 12);
    expect(realMonthlyRate(0.01, 0.04)).toBeCloseTo(0.006704312044747862, 12);
  });
});

describe("balanceSpending", () => {
  it("spends the balance over the withdrawal term", () => {
    expect(
      balanceSpending({
        balance: 112683,
        j: 0.01,
        inflation: null,
        withdraw: 120,
      }),
    ).toBe(1617);
  });
});

describe("delayedBalance", () => {
  it.each([
    { name: "no delay keeps the balance", delay: null, balance: 100000000 },
    // 1,000,000.00 at 1% for 12 months: 1.01^12 = 1.12682503013.
    { name: "twelve months of 1%", delay: 12, balance: 112682503 },
    { name: "a delay of zero", delay: 0, balance: 100000000 },
  ])("$name", ({ delay, balance }) => {
    expect(delayedBalance(100000000, 0.01, delay)).toBe(balance);
  });
});

describe("incomeTotals", () => {
  it("adds the living and the reinvested parts of every month", () => {
    const row = { month: 1, opening: 0, income: 0, closing: 0 };

    expect(
      incomeTotals([
        { ...row, reinvested: 250, living: 750 },
        { ...row, month: 2, reinvested: 251, living: 752 },
      ]),
    ).toEqual({ living: 1502, reinvested: 501 });
    expect(incomeTotals([])).toEqual({ living: 0, reinvested: 0 });
  });
});

describe("incomeSetup", () => {
  const valid = {
    balance: 100000000,
    j: 0.01,
    inflation: null,
    months: 2,
    share: 0.25,
    delay: null,
  };

  it("holds the inputs and the net rate when all are valid", () => {
    expect(incomeSetup(valid)).toEqual({
      balance: 100000000,
      j: 0.01,
      net: 0.01,
      months: 2,
      share: 0.25,
      term: 2,
    });
  });

  it("compounds the balance through a delay and counts it in the term", () => {
    const setup = incomeSetup({ ...valid, delay: 12 });

    expect(setup?.balance).toBe(112682503);
    expect(setup?.term).toBe(14);
    expect(setup?.months).toBe(2);
  });

  it.each([
    { name: "no balance", patch: { balance: null } },
    { name: "a zero balance", patch: { balance: 0 } },
    { name: "no rate", patch: { j: null } },
    { name: "no term", patch: { months: null } },
    { name: "an invalid share", patch: { share: null } },
    { name: "inflation at the return", patch: { inflation: 0.2 } },
    { name: "a zero rate", patch: { j: 0 } },
  ])("is null for $name", ({ patch }) => {
    expect(incomeSetup({ ...valid, ...patch })).toBeNull();
  });
});
