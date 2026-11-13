import { describe, expect, it } from "vitest";

import {
  defaultFrom,
  periodDays,
  periodProblem,
} from "@/features/portfolio/return/portfolio-period";

describe("defaultFrom", () => {
  it.each([
    ["2026-10-31", "2025-11-01"],
    ["2026-10-17", "2025-10-18"],
    ["2026-02-28", "2025-03-01"],
    ["2028-02-29", "2027-03-02"],
  ])("starts the 12 months ending %s on %s", (to, from) => {
    expect(defaultFrom(to)).toBe(from);
  });

  it.each([
    ["2026-11-13", 3, "2023-11-14"],
    ["2026-11-13", 10, "2016-11-14"],
  ])("starts the %s years ending %s on %s (HR2)", (to, years, from) => {
    expect(defaultFrom(to, years)).toBe(from);
  });
});

describe("periodDays", () => {
  it.each([
    ["2025-11-14", "2026-11-13", 365],
    ["2026-10-31", "2026-10-31", 1],
  ])("counts %s to %s as %i days", (from, to, days) => {
    expect(periodDays(from, to)).toBe(days);
  });
});

describe("periodProblem", () => {
  it.each([
    ["2025-11-01", "2026-10-31", undefined],
    ["2016-10-24", "2026-10-31", undefined],
    ["2016-10-23", "2026-10-31", "tooLong"],
    ["2026-10-31", "2026-10-30", "reversed"],
    ["2026-10-31", "2026-10-31", undefined],
  ])("reads %s to %s as %s", (from, to, problem) => {
    expect(periodProblem(from, to)).toBe(problem);
  });
});
