import { describe, expect, it } from "vitest";

import { maturityOf } from "@/features/instruments/terms/maturity";

describe("maturityOf", () => {
  it.each([
    [
      "2026-01-01",
      "2026-01-11",
      "2026-01-06",
      { state: "running", percent: 50, elapsedDays: 5, totalDays: 10, days: 5 },
    ],
    [
      "2026-01-01",
      "2026-01-11",
      "2025-12-30",
      {
        state: "upcoming",
        percent: 0,
        elapsedDays: 0,
        totalDays: 10,
        days: 12,
      },
    ],
    [
      "2026-01-01",
      "2026-01-11",
      "2026-01-11",
      {
        state: "matured",
        percent: 100,
        elapsedDays: 10,
        totalDays: 10,
        days: 0,
      },
    ],
    [
      "2026-01-01",
      "2026-01-11",
      "2026-01-14",
      {
        state: "matured",
        percent: 100,
        elapsedDays: 10,
        totalDays: 10,
        days: 3,
      },
    ],
    [
      "2023-03-01",
      "2029-03-01",
      "2026-11-11",
      {
        state: "running",
        percent: 62,
        elapsedDays: 1351,
        totalDays: 2192,
        days: 841,
      },
    ],
  ])("reads %s to %s on %s", (issued, matures, today, expected) => {
    expect(maturityOf(issued, matures, today)).toEqual(expected);
  });
});
