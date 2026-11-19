import { describe, expect, it } from "vitest";

import {
  accumulationFacts,
  accumulationResult,
  rangeOf,
  splitRow,
  waitingCost,
} from "@/features/calculators/compound-calculator/accumulation-figures";
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
