import { describe, expect, it } from "vitest";

import { segmentLabel } from "@/features/portfolio/contribution-plan/model/segment-label";

describe("segmentLabel", () => {
  const cases = [
    {
      name: "name and percent fit",
      width: 120,
      full: 100,
      short: 30,
      want: "full",
    },
    {
      name: "name and percent fit exactly",
      width: 100,
      full: 100,
      short: 30,
      want: "full",
    },
    {
      name: "only the percent fits",
      width: 60,
      full: 100,
      short: 30,
      want: "percent",
    },
    {
      name: "the percent fits exactly",
      width: 30,
      full: 100,
      short: 30,
      want: "percent",
    },
    { name: "nothing fits", width: 29, full: 100, short: 30, want: "none" },
    { name: "an empty segment", width: 0, full: 100, short: 30, want: "none" },
  ] as const;

  it.each(cases)("$name", ({ width, full, short, want }) => {
    expect(segmentLabel(width, full, short)).toBe(want);
  });
});
