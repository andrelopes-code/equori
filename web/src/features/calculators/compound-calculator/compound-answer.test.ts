import { describe, expect, it } from "vitest";

import {
  accumulationFacts,
  accumulationResult,
  balanceSpending,
  emptySentence,
  rateFieldValue,
  realMonthlyRate,
  termIncomeRows,
  incomeAtEnd,
  livingIncome,
  rangeOf,
  splitRow,
  termIncome,
  waitingCost,
} from "@/features/calculators/compound-calculator/compound-answer";
import { catalogPtBR } from "@/i18n/catalog.pt-BR";
import type { TFunction } from "@/i18n/i18n-provider";
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

describe("accumulationFacts", () => {
  const base = {
    target: false,
    deposited: 13000000,
    final: 22739502,
    today: 14642595,
    delayed: 19523136,
    format: (minor: number) => `$${String(minor)}`,
    labels: {
      deposited: "Deposited",
      interest: "Interest",
      today: "Today",
      delayed: "Delayed",
      wait: "Wait",
    },
  };

  it.each([
    {
      name: "today's money, the delayed amount and the cost of waiting",
      input: base,
      terms: ["Today", "Delayed", "Wait"],
      values: ["$14642595", "$19523136", "$3216366"],
    },
    {
      name: "only the cost of a delay without an inflation",
      input: { ...base, today: null },
      terms: ["Delayed", "Wait"],
      values: ["$19523136", "$3216366"],
    },
    {
      name: "a target states the deposits and the interest first, three at most",
      input: { ...base, target: true },
      terms: ["Deposited", "Interest", "Today"],
      values: ["$13000000", "$9739502", "$14642595"],
    },
    {
      name: "nothing without an inflation or a delay",
      input: { ...base, today: null, delayed: null },
      terms: [],
      values: [],
    },
  ])("$name", ({ input, terms, values }) => {
    const facts = accumulationFacts(input);

    expect(facts.map((f) => f.term)).toEqual(terms);
    expect(facts.map((f) => f.value)).toEqual(values);
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

describe("emptySentence", () => {
  const t: TFunction = (key, vars) =>
    catalogPtBR[key].replace(/\{(\w+)\}/g, (_, name: string) =>
      String(vars?.[name]),
    );
  const order = ["target", "term", "rate"] as const;
  const labels = { target: "Meta", term: "Prazo", rate: "Taxa de juros" };
  const sentence = (missing: Record<(typeof order)[number], boolean>) =>
    emptySentence({
      order,
      labels,
      missing,
      what: "o valor final",
      t,
      tag: "pt-BR",
    });

  it.each([
    {
      name: "names every missing input in reading order",
      missing: { target: true, term: true, rate: true },
      text: "Preencha meta, prazo e taxa de juros para ver o valor final.",
    },
    {
      name: "names one missing input",
      missing: { target: false, term: true, rate: false },
      text: "Preencha prazo para ver o valor final.",
    },
    {
      name: "is empty when nothing is missing",
      missing: { target: false, term: false, rate: false },
      text: "",
    },
  ])("$name", ({ missing, text }) => {
    expect(sentence(missing)).toBe(text);
  });
});

describe("realMonthlyRate", () => {
  it("keeps the rate without an inflation and subtracts the monthly inflation with one", () => {
    expect(realMonthlyRate(0.01, null)).toBe(0.01);
    expect(realMonthlyRate(0.01, 0.04)).toBeCloseTo(
      0.01 - annualToMonthly(0.04),
      12,
    );
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

describe("rateFieldValue", () => {
  it.each([
    { name: "typed text", typed: "12", indexed: false, from: null, text: "12" },
    {
      name: "empty without text",
      typed: undefined,
      indexed: false,
      from: null,
      text: "",
    },
    {
      name: "the rate of an index",
      typed: "9",
      indexed: true,
      from: { rate: 0.110021 },
      text: "11.0021",
    },
    {
      name: "empty while an index loads",
      typed: "9",
      indexed: true,
      from: null,
      text: "",
    },
  ])("$name", ({ typed, indexed, from, text }) => {
    expect(rateFieldValue(typed, indexed, from)).toBe(text);
  });
});
