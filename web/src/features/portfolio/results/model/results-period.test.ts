import { describe, expect, it } from "vitest";

import {
  periodRange,
  periodRead,
  seriesStep,
} from "@/features/portfolio/results/model/results-period";
import type { ResultsPeriod } from "@/features/portfolio/results/results-search";

const today = "2026-11-24";

describe("periodRange", () => {
  it.each<[ResultsPeriod, string]>([
    ["1m", "2026-10-25"],
    ["3m", "2026-08-25"],
    ["6m", "2026-05-25"],
    ["ytd", "2026-01-01"],
    ["12m", "2025-11-25"],
    ["2y", "2024-11-25"],
    ["5y", "2021-11-25"],
  ])("starts %s on %s", (period, from) => {
    expect(periodRange(period, today)).toEqual({ from, to: today });
  });

  it("holds no start for the whole history", () => {
    expect(periodRange(undefined, today)).toEqual({ to: today });
  });

  it("clamps the day to the end of a shorter month", () => {
    expect(periodRange("1m", "2026-03-31")).toEqual({
      from: "2026-03-01",
      to: "2026-03-31",
    });
  });
});

describe("seriesStep", () => {
  it.each([
    ["2026-05-25", "2026-11-24", "day"],
    ["2026-05-24", "2026-11-24", "week"],
    ["2024-11-25", "2026-11-24", "week"],
    ["2024-11-24", "2026-11-24", "month"],
    [undefined, "2026-11-24", "month"],
  ] as const)("steps %s to %s by %s", (from, to, want) => {
    expect(seriesStep(from, to)).toBe(want);
  });
});

describe("periodRead", () => {
  // PR3: the whole history read by month is the period read itself.
  it("reads no period of its own for a whole history of years", () => {
    expect(periodRead(undefined, "2024-11-24", today)).toEqual({
      from: "2024-11-24",
      step: "month",
      own: false,
    });
  });

  // PR3: a whole history of two weeks has one month point; its period is read by day.
  it("reads a short whole history at the step of its length", () => {
    expect(periodRead(undefined, "2026-11-13", today)).toEqual({
      from: "2026-11-13",
      step: "day",
      own: true,
    });
  });

  it("waits for the history before reading the whole history", () => {
    expect(periodRead(undefined, undefined, today)).toEqual({
      from: undefined,
      step: "month",
      own: false,
    });
  });

  it("reads a chosen period from its own start", () => {
    expect(periodRead("2026-10-25", "2024-11-24", today)).toEqual({
      from: "2026-10-25",
      step: "day",
      own: true,
    });
  });
});
