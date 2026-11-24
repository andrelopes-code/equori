import { describe, expect, it } from "vitest";

import { monthFigures, type MonthReturn } from "@/ui/month-heat/month-figures";

describe("monthFigures", () => {
  it("names the best and the worst month and counts the signs", () => {
    const months: MonthReturn[] = [
      { month: "2025-11", value: 0.01 },
      { month: "2025-12", value: 0.02 },
      { month: "2026-01", value: -0.03 },
      { month: "2026-02", value: 0 },
    ];

    expect(monthFigures(months)).toEqual({
      best: { month: "2025-12", value: 0.02 },
      worst: { month: "2026-01", value: -0.03 },
      positive: 2,
      negative: 1,
      total: 4,
    });
  });

  it("is null without a month", () => {
    expect(monthFigures([])).toBeNull();
  });
});
