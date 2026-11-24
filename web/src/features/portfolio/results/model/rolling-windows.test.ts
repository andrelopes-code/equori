import { describe, expect, it } from "vitest";

import type { MonthReturn } from "@/features/portfolio/results/model/month-returns";
import {
  rollingWindows,
  shareAbove,
  type Window,
} from "@/features/portfolio/results/model/rolling-windows";

function months(count: number, value: number): MonthReturn[] {
  return Array.from({ length: count }, (_, i) => ({
    month: `${String(2025 + Math.floor(i / 12))}-${String((i % 12) + 1).padStart(2, "0")}`,
    value,
  }));
}

const windows: Window[] = [
  { end: "2026-10", value: 0.1 },
  { end: "2026-11", value: -0.02 },
  { end: "2026-12", value: 0.05 },
];

describe("rollingWindows", () => {
  it("compounds 12 months on each month from the twelfth", () => {
    const got = rollingWindows(months(13, 0.01));

    expect(got.map((w) => w.end)).toEqual(["2025-12", "2026-01"]);
    expect(got[0]?.value).toBeCloseTo(0.126825, 6);
    expect(got[1]?.value).toBeCloseTo(0.126825, 6);
  });

  it("holds no window under 12 months", () => {
    expect(rollingWindows(months(11, 0.01))).toEqual([]);
  });

  it("takes the size of the window", () => {
    expect(rollingWindows(months(3, 0.01), 2)).toHaveLength(2);
  });
});

describe("shareAbove", () => {
  it.each([
    ["zero", 0, 2 / 3],
    [
      "reference windows with the same ends",
      [
        { end: "2026-10", value: 0.08 },
        { end: "2026-11", value: 0.01 },
        { end: "2026-12", value: 0.05 },
      ],
      1 / 3,
    ],
    [
      "reference windows that the windows lead",
      [
        { end: "2026-10", value: 0.08 },
        { end: "2026-11", value: -0.05 },
        { end: "2026-12", value: 0.05 },
      ],
      2 / 3,
    ],
  ] as const)("counts the windows above %s", (_, reference, want) => {
    expect(shareAbove(windows, reference)).toBeCloseTo(want, 6);
  });

  it("is zero without windows", () => {
    expect(shareAbove([], 0)).toBe(0);
  });
});
