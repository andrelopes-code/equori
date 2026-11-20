import { describe, expect, it } from "vitest";

import { goalMonthly } from "@/features/assistant/proposal/bodies/goal-monthly";

describe("goalMonthly", () => {
  it("spreads the target over the months to the due month", () => {
    expect(goalMonthly(1500000, "2026-11-19", "2027-07-31")).toEqual({
      months: 8,
      monthly: 187500,
    });
  });

  it("rounds up so the months reach the target", () => {
    expect(goalMonthly(1000, "2026-11-19", "2027-02-01")).toEqual({
      months: 3,
      monthly: 334,
    });
  });

  it("asks the whole target when the due month is this month", () => {
    expect(goalMonthly(5000, "2026-11-19", "2026-11-30")).toEqual({
      months: 0,
      monthly: 5000,
    });
  });
});
