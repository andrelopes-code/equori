import { describe, expect, it } from "vitest";

import { readFinancing } from "@/features/calculators/financing-calculator/financing-input";

describe("readFinancing", () => {
  const cases = [
    {
      name: "an empty address misses the three given figures",
      search: {},
      missing: { amount: true, rate: true, months: true, installment: false },
    },
    {
      name: "text that is not a number counts as missing",
      search: { amount: "abc", rate: "x", months: "1.5.2" },
      missing: { amount: true, rate: true, months: true, installment: false },
    },
    {
      name: "a negative rate counts as missing",
      search: { amount: "1000000", rate: "-1", months: "12" },
      missing: { amount: false, rate: true, months: false, installment: false },
    },
    {
      name: "a zero amount counts as missing",
      search: { amount: "0", rate: "1", period: "month", months: "12" },
      missing: { amount: true, rate: false, months: false, installment: false },
    },
    {
      name: "a zero installment counts as missing when it is given",
      search: {
        solve: "amount",
        installment: "0",
        rate: "1",
        period: "month",
        months: "12",
      },
      missing: { amount: false, rate: false, months: false, installment: true },
    },
    {
      name: "the solved figure is never missing",
      search: { solve: "rate", amount: "1000000", months: "12" },
      missing: { amount: false, rate: false, months: false, installment: true },
    },
  ];

  it.each(cases)("$name", ({ search, missing }) => {
    const input = readFinancing(search);

    expect(input.missing).toEqual(missing);
    expect(input.complete).toBe(false);
    expect(input.solved).toBeNull();
  });

  it("reads a complete loan and solves its installment", () => {
    const input = readFinancing({
      amount: "1000000",
      rate: "1",
      period: "month",
      months: "12",
    });

    expect(input.solve).toBe("installment");
    expect(input.complete).toBe(true);
    expect(input.solved).toMatchObject({
      amount: 1000000,
      months: 12,
      installment: 88849,
    });
    expect(input.solved?.rate).toBeCloseTo(0.01, 10);
  });

  it("reads a yearly rate as its monthly equivalent", () => {
    const input = readFinancing({
      amount: "1000000",
      rate: "12",
      months: "12",
    });

    expect(input.period).toBe("year");
    expect(input.solved?.rate).toBeCloseTo(1.12 ** (1 / 12) - 1, 10);
  });
});
