import { describe, expect, it } from "vitest";

import { balances } from "@/features/calculators/compound-math";
import { annualToMonthly } from "@/features/calculators/rate-math";
import { simulate } from "@/features/calculators/simulation";

const input = {
  initial: 100000,
  deposit: 10000,
  months: 12,
  annualRate: 0.12,
};

describe("simulate", () => {
  it("gives three equal percentiles, the final amount of M2, without volatility", () => {
    const want =
      balances(100000, 10000, annualToMonthly(0.12), 12)[11]?.balance ?? 0;
    const got = simulate({ ...input, annualVolatility: 0 });
    for (const p of [got.p10, got.p50, got.p90])
      expect(Math.abs(p - want)).toBeLessThanOrEqual(12);
    expect(got.p10).toBe(got.p90);
  });

  it("orders the percentiles with volatility", () => {
    const got = simulate({ ...input, annualVolatility: 0.2 });
    expect(got.p10).toBeLessThan(got.p50);
    expect(got.p50).toBeLessThan(got.p90);
  });

  it("returns the same percentiles for the same input", () => {
    expect(simulate({ ...input, annualVolatility: 0.2 })).toEqual(
      simulate({ ...input, annualVolatility: 0.2 }),
    );
  });

  it("changes with the seed", () => {
    expect(simulate({ ...input, annualVolatility: 0.2, seed: 2 }).p10).not.toBe(
      simulate({ ...input, annualVolatility: 0.2 }).p10,
    );
  });
});
