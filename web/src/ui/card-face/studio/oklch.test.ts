import { describe, expect, it } from "vitest";

import { presetColors } from "@/ui/card-face/studio/face-draft";
import {
  hexToOklch,
  normalizeHex,
  oklchToHex,
} from "@/ui/card-face/studio/oklch";

describe("oklchToHex", () => {
  it("maps the lightness extremes to white and black", () => {
    expect(oklchToHex(1, 0, 0)).toBe("#ffffff");
    expect(oklchToHex(0, 0, 0)).toBe("#000000");
  });

  it("clamps an out-of-gamut colour to a valid hex", () => {
    expect(oklchToHex(0.7, 0.4, 150)).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("hexToOklch", () => {
  it("reads pure red", () => {
    const { l, c, h } = hexToOklch("#ff0000");

    expect(l).toBeCloseTo(0.628, 2);
    expect(c).toBeCloseTo(0.2577, 2);
    expect(h).toBeCloseTo(29.23, 2);
  });

  it.each(presetColors.map(({ hex }) => hex))("round-trips %s", (hex) => {
    const { l, c, h } = hexToOklch(hex);

    expect(oklchToHex(l, c, h)).toBe(hex);
  });
});

describe("normalizeHex", () => {
  it("lower-cases a valid colour and rejects the rest", () => {
    expect(normalizeHex("#0B4EA2")).toBe("#0b4ea2");
    expect(normalizeHex("#12")).toBeNull();
    expect(normalizeHex("0b4ea2")).toBeNull();
    expect(normalizeHex("#0b4ea2f")).toBeNull();
  });
});
