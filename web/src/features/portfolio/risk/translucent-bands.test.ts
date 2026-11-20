import { describe, expect, it } from "vitest";

import {
  translucentBands,
  withAlpha,
} from "@/features/portfolio/risk/translucent-bands";

describe("translucentBands", () => {
  it("takes the oklch colour of each band to 12% alpha", () => {
    const option = {
      series: [
        {
          markArea: {
            data: [
              [{ itemStyle: { color: "oklch(0.7 0.02 250)" } }, { xAxis: 3 }],
              [{ itemStyle: { color: "rgba(1, 2, 3, 0.12)" } }, { xAxis: 5 }],
            ],
          },
        },
        { type: "line" },
      ],
    };

    translucentBands(option);

    const colors = option.series[0]?.markArea?.data.map(
      ([s]) => s?.itemStyle?.color,
    );

    expect(colors).toEqual([
      "oklch(0.7 0.02 250 / 0.12)",
      "rgba(1, 2, 3, 0.12)",
    ]);
  });

  it("keeps a colour that already holds an alpha or is not oklch", () => {
    expect(withAlpha("oklch(0.7 0.02 250 / 0.5)", 0.12)).toBe(
      "oklch(0.7 0.02 250 / 0.5)",
    );
    expect(withAlpha("#123456", 0.12)).toBe("#123456");
  });
});
