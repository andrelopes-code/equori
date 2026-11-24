import { describe, expect, it } from "vitest";

import { withEndLabels } from "@/features/portfolio/results/return-block/end-labels";

describe("withEndLabels", () => {
  it("labels the series named by id and leaves room at the right", () => {
    const option = withEndLabels(
      { grid: { left: 4 }, series: [{ id: "portfolio" }, { id: "other" }] },
      { portfolio: "Portfolio 3.02%" },
    );

    expect(option).toEqual({
      grid: { left: 4, right: 120 },
      series: [
        {
          id: "portfolio",
          endLabel: { show: true, formatter: "Portfolio 3.02%", distance: 8 },
          labelLayout: { moveOverlap: "shiftY" },
        },
        { id: "other" },
      ],
    });
  });

  it("draws one end label per series and no second label", () => {
    const option = withEndLabels(
      {
        series: [
          { id: "portfolio", label: { show: true } },
          { id: "cdi", label: { show: true } },
        ],
      },
      { portfolio: "Portfolio 3.02%", cdi: "CDI 1.00%" },
    );

    const labelled = (id: string, formatter: string) => ({
      id,
      label: { show: false },
      endLabel: { show: true, formatter, distance: 8 },
      labelLayout: { moveOverlap: "shiftY" },
    });

    expect(option.series).toEqual([
      labelled("portfolio", "Portfolio 3.02%"),
      labelled("cdi", "CDI 1.00%"),
    ]);
  });

  it("returns an option without series as it is", () => {
    const option = { grid: {} };

    expect(withEndLabels(option, {})).toBe(option);
  });
});
