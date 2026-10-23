import { describe, expect, it } from "vitest";

import {
  completionMonth,
  completionWithReturn,
  defaultMonthly,
} from "@/features/goals/goal-plan";

describe("goal plan", () => {
  it("completes after the months the remainder takes at the monthly amount", () => {
    expect(completionMonth("2026-10-17", 1000000, 200000)).toBe("2027-03");
    expect(completionMonth("2026-10-17", 1000001, 200000)).toBe("2027-04");
    expect(completionMonth("2026-10-17", 0, 200000)).toBe("2026-10");
    expect(completionMonth("2026-10-17", 1000, 0)).toBeNull();
  });

  it("proposes the monthly amount that meets the due date, rounded up to the step", () => {
    expect(defaultMonthly("2026-10-17", "2027-06-30", 2000000)).toBe(250000);
    expect(defaultMonthly("2026-10-17", "2027-06-30", 2010000)).toBe(255000);
    expect(defaultMonthly("2026-10-17", "2026-10-31", 12000)).toBe(15000);
    expect(defaultMonthly("2026-10-17", "2026-09-30", 0)).toBe(5000);
    expect(defaultMonthly("2026-10-17", "2026-11-30", 100000000)).toBe(500000);
    expect(defaultMonthly("2026-10-17", "2027-06-30", 20000, 1)).toBe(2500);
  });
});

describe("goal plan with a return", () => {
  it("matches the plain division at a zero rate", () => {
    expect(completionWithReturn("2026-10-17", 1000000, 200000, 0)).toBe(
      completionMonth("2026-10-17", 1000000, 200000),
    );
  });

  it("completes sooner when the balance earns", () => {
    // 10,000.00 left over a balance of 50,000.00 and 2,000.00 a month: 5 months plain, 4 at 12% a year.
    expect(
      completionWithReturn("2026-10-17", 1000000, 200000, 0, 5000000),
    ).toBe("2027-03");
    expect(
      completionWithReturn("2026-10-17", 1000000, 200000, 12, 5000000),
    ).toBe("2027-02");
  });

  it("completes on the spot when nothing remains", () => {
    expect(completionWithReturn("2026-10-17", 0, 0, 5)).toBe("2026-10");
  });

  it("gives up after a century without a monthly amount or a balance to earn on", () => {
    expect(completionWithReturn("2026-10-17", 1000, 0, 5)).toBeNull();
  });
});
