import { describe, expect, it } from "vitest";

import { contributed } from "@/features/portfolio/results/model/wealth";

describe("contributed", () => {
  it("adds the flows to the opening value as a running sum", () => {
    const points = [0, 100000, 0].map((flows, i) => ({
      date: `2026-0${String(i + 1)}-28`,
      value: 0,
      flows,
    }));

    expect(contributed(100000, points)).toEqual([100000, 200000, 200000]);
  });

  it("holds nothing without points", () => {
    expect(contributed(100000, [])).toEqual([]);
  });
});
