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
});
