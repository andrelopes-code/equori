import { describe, expect, it } from "vitest";

import { moveBoundary } from "@/features/portfolio/contribution-plan/model/move-boundary";

describe("moveBoundary", () => {
  const targets = [4000, 2500, 2000, 1500];
  const free = [false, false, false, false];

  const cases: {
    name: string;
    locked: boolean[];
    boundary: number;
    delta: number;
    want: number[];
  }[] = [
    {
      name: "moves 500 bp to the left neighbour",
      locked: free,
      boundary: 0,
      delta: 500,
      want: [4500, 2000, 2000, 1500],
    },
    {
      name: "stops when the right neighbour reaches 0",
      locked: free,
      boundary: 0,
      delta: 3000,
      want: [6500, 0, 2000, 1500],
    },
    {
      name: "stops when the left neighbour reaches 0",
      locked: free,
      boundary: 0,
      delta: -4500,
      want: [0, 6500, 2000, 1500],
    },
    {
      name: "snaps the transfer to 10 bp",
      locked: free,
      boundary: 0,
      delta: 37,
      want: [4040, 2460, 2000, 1500],
    },
    {
      name: "snaps a negative transfer to 10 bp",
      locked: free,
      boundary: 0,
      delta: -35,
      want: [3960, 2540, 2000, 1500],
    },
    {
      name: "keeps the targets when a neighbour is locked",
      locked: [false, false, true, false],
      boundary: 1,
      delta: 500,
      want: [4000, 2500, 2000, 1500],
    },
    {
      name: "moves the last boundary to the left",
      locked: free,
      boundary: 2,
      delta: -1500,
      want: [4000, 2500, 500, 3000],
    },
    {
      name: "keeps the targets when the boundary does not exist",
      locked: free,
      boundary: 3,
      delta: 500,
      want: [4000, 2500, 2000, 1500],
    },
  ];

  it.each(cases)("$name", ({ locked, boundary, delta, want }) => {
    const got = moveBoundary(targets, locked, boundary, delta);

    expect(got).toEqual(want);
    expect(got.reduce((sum, v) => sum + v, 0)).toBe(10000);
  });

  it("does not change its input", () => {
    moveBoundary(targets, free, 0, 500);

    expect(targets).toEqual([4000, 2500, 2000, 1500]);
  });
});
