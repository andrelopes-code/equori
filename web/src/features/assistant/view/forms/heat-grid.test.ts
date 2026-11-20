import { describe, expect, it } from "vitest";

import { heatGrid } from "@/features/assistant/view/forms/heat-grid";

describe("heatGrid", () => {
  it("starts November 2026, a Sunday, on the first column of a Sunday week", () => {
    expect(heatGrid("2026-11", [0, 0], 30, 7).blanks).toBe(0);
  });

  it("leaves six blanks before it in a Monday week", () => {
    expect(heatGrid("2026-11", [0, 0], 30, 1).blanks).toBe(6);
  });

  it("scales each counted day to the peak and leaves later days without a level", () => {
    const { cells } = heatGrid("2026-11", [100, 400, 0], 2, 7);

    expect(cells).toEqual([
      { day: 1, level: 0.25 },
      { day: 2, level: 1 },
      { day: 3 },
    ]);
  });
});
