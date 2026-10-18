import { describe, expect, it } from "vitest";

import {
  addMonths,
  currentMonth,
  monthRange,
} from "@/features/cards/reference-months";

describe("addMonths", () => {
  it.each([
    ["2026-10", -12, "2025-10"],
    ["2026-12", 1, "2027-01"],
    ["2026-01", -1, "2025-12"],
    ["2026-10", 0, "2026-10"],
    ["2026-10", 27, "2029-01"],
  ] as const)("addMonths(%s, %i) is %s", (month, delta, want) => {
    expect(addMonths(month, delta)).toBe(want);
  });
});

describe("currentMonth", () => {
  it("takes the year and month of an ISO date", () => {
    expect(currentMonth("2026-10-18")).toBe("2026-10");
  });
});

describe("monthRange", () => {
  it("lists months ascending and inclusive", () => {
    const range = monthRange("2026-10", 12, 24);
    expect(range).toHaveLength(37);
    expect(range[0]).toBe("2025-10");
    expect(range[12]).toBe("2026-10");
    expect(range[36]).toBe("2028-10");
  });

  it("returns only the center for zero spans", () => {
    expect(monthRange("2026-10", 0, 0)).toEqual(["2026-10"]);
  });
});
