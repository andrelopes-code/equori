import { describe, expect, it } from "vitest";

import {
  balances,
  depositForTarget,
  depositsValue,
  futureValue,
} from "@/features/calculators/compound-math";

describe("compound math", () => {
  it("grows a capital (M1)", () => {
    expect(futureValue(100000, 0.01, 12)).toBe(112683);
  });

  it("grows deposits made at the start of each month (M2)", () => {
    expect(depositsValue(10000, 0.005, 12)).toBe(123972);
  });

  it("zero rate", () => {
    expect(depositsValue(10000, 0, 12)).toBe(120000);
    expect(futureValue(100000, 0, 12)).toBe(100000);
  });

  it("finds the deposit that reaches a target", () => {
    expect(depositForTarget(123972, 0, 0.005, 12)).toBe(10000);
    expect(depositForTarget(120000, 0, 0, 12)).toBe(10000);
  });

  it("needs no deposit when the capital alone reaches the target", () => {
    expect(depositForTarget(100000, 100000, 0.01, 12)).toBe(0);
  });

  it("lists the balance and the deposits of each month", () => {
    const rows = balances(100000, 10000, 0.01, 12);
    expect(rows).toHaveLength(12);
    const last = rows[11];
    expect(last?.month).toBe(12);
    expect(last?.deposited).toBe(220000);
    expect(
      Math.abs(
        (last?.balance ?? 0) -
          (futureValue(100000, 0.01, 12) + depositsValue(10000, 0.01, 12)),
      ),
    ).toBeLessThanOrEqual(12);
  });
});
