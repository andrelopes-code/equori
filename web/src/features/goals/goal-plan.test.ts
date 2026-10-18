import { describe, expect, it } from "vitest";

import { completionMonth, defaultMonthly } from "@/features/goals/goal-plan";

// Complete frontend decision R5-2.
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
