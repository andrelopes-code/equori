import { describe, expect, it } from "vitest";

import {
  readDate,
  readInt,
  readMinor,
  readMonth,
  readRate,
  validateCalculatorSearch,
} from "@/features/calculators/calculator-search";

describe("calculator search", () => {
  it("drops invalid search values", () => {
    // The router parses ?months=12 into a number; a finite number is kept as its text.
    expect(
      validateCalculatorSearch({
        months: "abc",
        amount: 100000,
        rate: "1.5",
        x: { a: 1 },
        y: true,
        long: "9".repeat(65),
      }),
    ).toEqual({ months: "abc", amount: "100000", rate: "1.5" });
    expect(readInt("abc", 1, 1200)).toBeNull();
    expect(readInt("-3", 1, 1200)).toBeNull();
    expect(readInt("99999", 1, 1200)).toBeNull();
    expect(readInt("12", 1, 1200)).toBe(12);
    expect(readInt(undefined, 1, 1200)).toBeNull();
  });

  it("reads a rate in percent as a fraction", () => {
    expect(readRate("1")).toBe(0.01);
    expect(readRate("-99.99")).toBeCloseTo(-0.9999, 10);
    expect(readRate("-100")).toBeNull();
    expect(readRate("1000.5")).toBeNull();
    expect(readRate("1,5")).toBeNull();
    expect(readRate("")).toBeNull();
  });

  it("reads minor units as a non-negative integer", () => {
    expect(readMinor("12.5")).toBeNull();
    expect(readMinor("-1")).toBeNull();
    expect(readMinor("0")).toBe(0);
    expect(readMinor("1000000000000000")).toBe(10 ** 15);
    expect(readMinor("1000000000000001")).toBeNull();
  });

  it("reads a month and a day", () => {
    expect(readMonth("2020-01")).toBe("2020-01");
    expect(readMonth("2020-13")).toBeNull();
    expect(readDate("2026-02-10")).toBe("2026-02-10");
    expect(readDate("2026-02-31")).toBeNull();
  });
});
