import { beforeEach, describe, expect, it } from "vitest";

import { applySurfaces, surfaceDefaults, surfaces } from "@/theme/surface";
import { surfaceRecipe } from "@/theme/surface-recipe";

describe("surface values", () => {
  beforeEach(() => {
    localStorage.clear();
    applySurfaces(surfaceDefaults);
  });

  it("writes a chosen value on the root and remembers it", () => {
    surfaces.depth.apply("oled");

    expect(document.documentElement).toHaveAttribute(
      "data-equori-depth",
      "oled",
    );
    expect(localStorage.getItem("equori.depth")).toBe("oled");
  });

  it("writes the default value too, so a nested element can return to it", () => {
    surfaces.borders.apply("strong");

    surfaces.borders.apply("subtle");

    expect(document.documentElement).toHaveAttribute(
      "data-equori-borders",
      "subtle",
    );
  });

  it("reads a stored value outside the set as the default", () => {
    localStorage.setItem("equori.shadows", "huge");

    expect(surfaces.shadows.read()).toBe("soft");
  });

  it("holds the defaults of the spec", () => {
    expect(surfaceDefaults).toEqual({
      depth: "standard",
      step: "standard",
      borders: "subtle",
      shadows: "soft",
      chart: "spectrum",
      contrast: "standard",
    });
  });

  it.each(["dark", "light"] as const)(
    "starts the spectrum series from the accent seed in %s",
    (scheme) => {
      const series = Object.values(
        surfaceRecipe.chart.spectrum[scheme] ?? {},
      ).map((slot) =>
        typeof slot === "string" || !("seed" in slot) ? null : slot,
      );

      expect(series.map((slot) => slot?.seed)).toEqual(
        Array<string>(8).fill("accent"),
      );
      expect(series.map((slot) => slot?.h)).toEqual([
        0, 135, 270, 90, 315, 210, 45, 120,
      ]);
    },
  );

  it.each(["spectrum", "accent"] as const)(
    "gives the %s series one chroma whatever the accent's chroma",
    (mode) => {
      for (const slot of Object.values(surfaceRecipe.chart[mode].dark ?? {})) {
        expect(slot).toMatchObject({ c: { scale: 1000, max: 0.16 } });
      }
    },
  );

  it("keeps the mono series on the accent's own chroma", () => {
    for (const slot of Object.values(surfaceRecipe.chart.mono.dark ?? {})) {
      expect(slot).toMatchObject({ c: { scale: 1, max: 0.16 } });
    }
  });

  it("keeps every pair of neighbouring spectrum series 75 degrees apart", () => {
    const turns = Object.values(surfaceRecipe.chart.spectrum.dark ?? {}).map(
      (slot) =>
        typeof slot === "string" || !("h" in slot) ? 0 : (slot.h ?? 0),
    );
    const gaps = turns.slice(1).map((turn, i) => {
      const gap = Math.abs(turn - (turns[i] ?? 0)) % 360;

      return Math.min(gap, 360 - gap);
    });

    expect(Math.min(...gaps)).toBe(75);
    expect(new Set(turns).size).toBe(8);
  });
});
