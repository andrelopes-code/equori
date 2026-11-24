import { describe, expect, it } from "vitest";

import { withoutAxisLabels } from "@/features/portfolio/results/evolution-block/hide-axis-labels";

describe("withoutAxisLabels", () => {
  it("turns off the labels of the category axis and keeps the rest", () => {
    const option = withoutAxisLabels({
      grid: { left: 88 },
      xAxis: { type: "category", axisLabel: { show: true, color: "red" } },
      yAxis: { axisLabel: { show: true } },
    });

    expect(option).toEqual({
      grid: { left: 88 },
      xAxis: { type: "category", axisLabel: { show: false, color: "red" } },
      yAxis: { axisLabel: { show: true } },
    });
  });

  it("turns off the labels of every axis of a list", () => {
    const option = withoutAxisLabels({ xAxis: [{}, { axisLabel: {} }] });

    expect(option.xAxis).toEqual([
      { axisLabel: { show: false } },
      { axisLabel: { show: false } },
    ]);
  });

  it("returns an option without a category axis as it is", () => {
    const option = { series: [] };

    expect(withoutAxisLabels(option)).toBe(option);
  });
});
