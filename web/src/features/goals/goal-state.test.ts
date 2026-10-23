import { describe, expect, it } from "vitest";

import { goalState, monthsLeft } from "@/features/goals/goal-state";

const money = (amount: number) => ({ amount, currency: "BRL" });
const goal = (remaining: number, due_on: string) => ({
  id: "g1",
  name: "Emergency",
  target: money(3000000),
  due_on,
  account_ids: ["a1"],
  current: money(3000000 - remaining),
  remaining: money(remaining),
  progress_bp: 0,
});

describe("goal state", () => {
  it("is reached once nothing remains, even after the due date", () => {
    expect(goalState(goal(0, "2026-01-31"), "2026-10-17")).toBe("reached");
  });

  it("is overdue when the due date passed with an amount remaining", () => {
    expect(goalState(goal(1, "2026-10-16"), "2026-10-17")).toBe("overdue");
  });

  it("is open on the due date and before it", () => {
    expect(goalState(goal(1, "2026-10-17"), "2026-10-17")).toBe("open");
    expect(goalState(goal(500, "2027-06-30"), "2026-10-17")).toBe("open");
  });

  it("counts the months from today's month to the due month", () => {
    expect(monthsLeft("2026-10-17", "2027-06-30")).toBe(8);
    expect(monthsLeft("2026-10-17", "2026-10-31")).toBe(0);
    expect(monthsLeft("2026-10-17", "2026-09-30")).toBe(-1);
  });
});
