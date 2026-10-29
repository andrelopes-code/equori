import { beforeEach, describe, expect, it } from "vitest";

import { applySurfaces, surfaceDefaults, surfaces } from "@/theme/surface";

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
});
