import { describe, expect, it } from "vitest";

import {
  axisPosition,
  comparisonAxis,
  type ReturnAxis,
} from "@/features/portfolio/return-axis";

describe("comparisonAxis", () => {
  const cases: { name: string; values: number[]; want: ReturnAxis }[] = [
    {
      name: "four positive values",
      values: [860, 1287, 812, 441],
      want: { min: 0, max: 1800, step: 600, ticks: [0, 600, 1200, 1800] },
    },
    {
      name: "the peak of a rate report",
      values: [1342, 1287, 1230, 441],
      want: { min: 0, max: 1800, step: 600, ticks: [0, 600, 1200, 1800] },
    },
    {
      name: "a negative value beside small positives",
      values: [-1000, 33, 0, 90],
      want: {
        min: -1600,
        max: 800,
        step: 800,
        ticks: [-1600, -800, 0, 800],
      },
    },
    {
      name: "every value zero",
      values: [0, 0],
      want: { min: 0, max: 100, step: 100, ticks: [0, 100] },
    },
    {
      name: "one value",
      values: [3300],
      want: { min: 0, max: 4500, step: 1500, ticks: [0, 1500, 3000, 4500] },
    },
    {
      name: "one small negative value",
      values: [-5],
      want: { min: -100, max: 0, step: 100, ticks: [-100, 0] },
    },
  ];

  it.each(cases)("$name", ({ values, want }) => {
    expect(comparisonAxis(values)).toEqual(want);
  });
});

describe("axisPosition", () => {
  const positive = axis(0, 1800, 600);
  const signed = axis(-1600, 800, 800);

  const cases: { name: string; axis: ReturnAxis; bp: number; want: number }[] =
    [
      { name: "the middle", axis: positive, bp: 900, want: 50 },
      { name: "the minimum", axis: positive, bp: 0, want: 0 },
      { name: "the maximum", axis: positive, bp: 1800, want: 100 },
      {
        name: "zero on a signed axis",
        axis: signed,
        bp: 0,
        want: 66.66666666666667,
      },
      {
        name: "the minimum of a signed axis",
        axis: signed,
        bp: -1600,
        want: 0,
      },
    ];

  it.each(cases)("$name", ({ axis, bp, want }) => {
    expect(axisPosition(axis, bp)).toBe(want);
  });
});

function axis(min: number, max: number, step: number): ReturnAxis {
  const ticks: number[] = [];

  for (let tick = min; tick <= max; tick += step) {
    ticks.push(tick);
  }

  return { min, max, step, ticks };
}
