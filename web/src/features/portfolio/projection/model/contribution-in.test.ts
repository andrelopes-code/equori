import { describe, expect, it } from "vitest";

import { contributionIn } from "@/features/portfolio/projection/model/contribution-in";

const changes = [
  { month: "2026-11-01", amount: 2000 },
  { month: "2029-01-01", amount: 3000 },
];

describe("contributionIn", () => {
  it.each([
    ["2026-10", 0],
    ["2026-11", 2000],
    ["2028-12", 2000],
    ["2029-01", 3000],
    ["2031-06", 3000],
  ])("holds the change in force in %s", (month, amount) => {
    expect(contributionIn(changes, month)).toBe(amount);
  });

  it("does not depend on the order of the changes", () => {
    expect(contributionIn([...changes].reverse(), "2028-12")).toBe(2000);
  });

  it("is zero without changes", () => {
    expect(contributionIn([], "2026-11")).toBe(0);
  });
});
