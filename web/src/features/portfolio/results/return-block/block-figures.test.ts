import { describe, expect, it } from "vitest";

import { historySeries } from "@/testing/portfolio-api";

import {
  blockFigures,
  comparisonsOf,
  toBasisPoints,
} from "@/features/portfolio/results/return-block/block-figures";

const series = {
  ...historySeries,
  indexes: [
    ...historySeries.indexes,
    {
      index: "ipca",
      period: "month" as const,
      points: [
        { date: "2025-11-30", return_bp: 50 },
        { date: "2025-12-31", return_bp: 90 },
      ],
    },
  ],
};

describe("blockFigures", () => {
  it("reads the total, the distance to the daily index and the real return", () => {
    const figures = blockFigures({
      ...series,
      indexes: series.indexes.map((i) => ({
        ...i,
        period: i.period === "month" ? ("month" as const) : ("day" as const),
      })),
    });

    expect(figures.total).toBeCloseTo(0.0302, 6);
    expect(figures.annual).toBeNull();
    expect(figures.volatility).toBeNull();
    expect(figures.fall).toBeNull();
    expect(figures.real?.value).toBeCloseTo(1.0302 / 1.009 - 1, 6);
    expect(figures.indexes.map((i) => [i.id, i.slot, i.daily])).toEqual([
      ["cdi", 2, true],
      ["ipca", 3, false],
    ]);
    expect(figures.indexes[0]?.apart).toBeCloseTo(0.0202, 6);
    expect(figures.indexes[1]?.apart).toBeNull();
  });

  it("draws the first daily index solid and the others dashed and dotted in turn", () => {
    const daily = (index: string) => ({
      index,
      period: "day" as const,
      points: historySeries.points.map((p) => ({ date: p.date, return_bp: 0 })),
    });
    const figures = blockFigures({
      ...series,
      indexes: ["cdi", "ibov", "ipca", "sp500"].map(daily),
    });

    expect(figures.indexes.map((i) => i.stroke)).toEqual([
      "solid",
      "dashed",
      "dotted",
      "dashed",
    ]);
  });

  it("compares only the daily indexes that are on", () => {
    const figures = blockFigures({
      ...series,
      indexes: series.indexes.map((i) => ({
        ...i,
        period: i.period === "month" ? ("month" as const) : ("day" as const),
      })),
    });

    expect(comparisonsOf(figures, ["cdi", "ipca"]).map((c) => c.id)).toEqual([
      "cdi",
    ]);
    expect(comparisonsOf(figures, [])).toEqual([]);
  });

  it("rounds a fraction to basis points", () => {
    expect(toBasisPoints(0.0302)).toBe(302);
  });
});
