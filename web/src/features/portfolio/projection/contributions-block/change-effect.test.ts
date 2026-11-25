import { describe, expect, it } from "vitest";

import { changeEffect } from "@/features/portfolio/projection/contributions-block/change-effect";

// Start 100000 at 1% a month; withdrawals start in 2027-02 and are not part of the value at the
// withdrawal age. Without the change: 102000, 104020, 106060.2. With 2000 from 2027-01: the third
// month is 104020 * 1.01 + 2000 = 107060.2.
const base = {
  start: 100000,
  monthlyRate: 0.01,
  months: ["2026-11", "2026-12", "2027-01", "2027-02"],
  withdrawalFrom: "2027-02",
  income: 0,
};
const others = [{ month: "2026-11-01", amount: 1000 }];

describe("changeEffect", () => {
  it("PX9: the value at the withdrawal age with and without the change", () => {
    const effect = changeEffect(base, others, {
      month: "2027-01-01",
      amount: 2000,
    });

    expect(effect.without).toBeCloseTo(106060.2, 2);
    expect(effect.value).toBeCloseTo(107060.2, 2);
    expect(effect.difference).toBeCloseTo(1000, 2);
  });

  it("PX9: a change dated after the withdrawal month leaves the value as it is", () => {
    const effect = changeEffect(base, others, {
      month: "2027-02-01",
      amount: 9000,
    });

    expect(effect.difference).toBeCloseTo(0, 6);
  });

  it("PX9: a change that lowers the contribution shows a negative difference", () => {
    const effect = changeEffect(base, others, {
      month: "2027-01-01",
      amount: 0,
    });

    expect(effect.difference).toBeCloseTo(-1000, 2);
  });
});
