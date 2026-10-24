import { describe, expect, it } from "vitest";

import { sharesBP } from "@/features/portfolio/portfolio-shares";

describe("sharesBP", () => {
  it.each([
    [
      [50500, 50000],
      [5024, 4976],
    ],
    [
      [10500, 2000],
      [8400, 1600],
    ],
    [
      [1, 1, 1],
      [3333, 3333, 3334],
    ],
    [[7], [10000]],
    [
      [0, 0],
      [0, 0],
    ],
    [[], []],
  ])("splits %j into %j", (amounts, expected) => {
    expect(sharesBP(amounts)).toEqual(expected);
  });

  it("does not lose precision above 2^53 / 10000", () => {
    const big = 900_000_000_000_000;
    expect(sharesBP([big, big])).toEqual([5000, 5000]);
  });
});
