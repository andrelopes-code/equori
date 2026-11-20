import { describe, expect, it } from "vitest";

import { alignedPlot } from "@/features/portfolio/risk/aligned-plot";

describe("alignedPlot", () => {
  it("starts the plot of every chart at one place", () => {
    const narrow = alignedPlot({ grid: { left: 8, top: 20 } });
    const wide = alignedPlot({ grid: { left: 8, top: 30 } });

    const bounds = {
      outerBoundsMode: "auto",
      outerBounds: { left: 0, right: 0, top: 0, bottom: 0 },
    };

    expect(narrow.grid).toEqual({ left: 64, top: 20, ...bounds });
    expect(wide.grid).toEqual({ left: 64, top: 30, ...bounds });
    expect(alignedPlot({ series: [] })).toEqual({ series: [] });
  });
});
