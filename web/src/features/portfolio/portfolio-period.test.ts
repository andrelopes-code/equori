import { describe, expect, it } from "vitest";

import {
  defaultFrom,
  periodProblem,
} from "@/features/portfolio/portfolio-period";

describe("defaultFrom", () => {
  it.each([
    ["2026-10-31", "2025-11-01"],
    ["2026-10-17", "2025-10-18"],
    ["2026-02-28", "2025-03-01"],
    ["2028-02-29", "2027-03-02"],
  ])("starts the 12 months ending %s on %s", (to, from) => {
    expect(defaultFrom(to)).toBe(from);
  });
});

describe("periodProblem", () => {
  it.each([
    ["2025-11-01", "2026-10-31", undefined],
    ["2025-10-30", "2026-10-31", undefined],
    ["2025-10-29", "2026-10-31", "tooLong"],
    ["2026-10-31", "2026-10-30", "reversed"],
    ["2026-10-31", "2026-10-31", undefined],
  ])("reads %s to %s as %s", (from, to, problem) => {
    expect(periodProblem(from, to)).toBe(problem);
  });
});
