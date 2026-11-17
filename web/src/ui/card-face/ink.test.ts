import { describe, expect, it } from "vitest";

import { contrast, inkOf, luminance } from "@/ui/card-face/ink";

describe("luminance", () => {
  it.each([
    ["#ffffff", 1],
    ["#000000", 0],
  ])("%s has luminance %d", (hex, expected) => {
    expect(luminance(hex)).toBe(expected);
  });
});

describe("contrast", () => {
  it("is 21 between white and black, in either order", () => {
    expect(contrast("#ffffff", "#000000")).toBe(21);
    expect(contrast("#000000", "#ffffff")).toBe(21);
  });
});

describe("inkOf", () => {
  it.each([
    ["#820ad1", "light", 7.2084],
    ["#fce300", "dark", 15.645],
    ["#ec7000", "dark", 6.6786],
    ["#1b1b1f", "light", 17.1686],
  ])("%s takes the %s ink at ratio %f", (color, ink, ratio) => {
    const result = inkOf(color);

    expect(result.ink).toBe(ink);
    expect(result.ratio).toBeCloseTo(ratio, 3);
  });

  it("holds a ratio of at least 4.5 across the colour cube in steps of 15", () => {
    const steps = Array.from({ length: 18 }, (_, i) => i * 15);
    let lowest = Infinity;

    for (const r of steps) {
      for (const g of steps) {
        for (const b of steps) {
          lowest = Math.min(lowest, inkOf(hex(r, g, b)).ratio);
        }
      }
    }

    expect(lowest).toBeGreaterThanOrEqual(4.5);
  });
});

function hex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}
