import { describe, expect, it } from "vitest";

import {
  addYears,
  daysBetween,
  isOlderThan,
} from "@/features/calculators/indexer-comparison/comparison-dates";

describe("comparison dates", () => {
  it("adds years, moving February 29 to February 28", () => {
    expect(addYears("2026-11-17", 2)).toBe("2028-11-17");
    expect(addYears("2024-02-29", 1)).toBe("2025-02-28");
  });

  it("counts the calendar days between two dates", () => {
    expect(daysBetween("2026-11-17", "2028-11-17")).toBe(731);
    expect(daysBetween("2026-11-17", "2026-11-17")).toBe(0);
  });

  it("tells a date older than a number of days from one that is not", () => {
    expect(isOlderThan("2026-11-06", "2026-11-17", 11)).toBe(false);
    expect(isOlderThan("2026-11-05", "2026-11-17", 11)).toBe(true);
  });
});
