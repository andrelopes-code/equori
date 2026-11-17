import { describe, expect, it } from "vitest";

import { trackOf } from "@/ui/card-face/studio/mixer-axes";

const mix = { l: 0.5, c: 0.1, h: 120 };

describe("trackOf", () => {
  it("runs the hue track over nine stops with the lightness of the mix", () => {
    const track = trackOf("h", mix);

    expect(track.match(/oklch\(/g)).toHaveLength(9);
    expect(track).toContain("oklch(0.500 0.100 0)");
    expect(track).toContain("oklch(0.500 0.100 360)");
  });

  it("raises a grey chroma so the hue track stays visible", () => {
    expect(trackOf("h", { ...mix, c: 0 })).toContain("oklch(0.500 0.080 45)");
  });

  it("runs the chroma track from grey to the full chroma at the hue", () => {
    expect(trackOf("c", mix)).toBe(
      "linear-gradient(to right, oklch(0.500 0 120.0), oklch(0.500 0.3 120.0))",
    );
  });

  it("runs the lightness track from dark to light at the chroma and hue", () => {
    const track = trackOf("l", mix);

    expect(track).toContain("oklch(0.15 0.100 120.0)");
    expect(track).toContain("oklch(0.97 0.100 120.0)");
  });
});
