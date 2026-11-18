import { beforeEach, describe, expect, it } from "vitest";

import { defaultAccent, readAccent } from "@/theme/accent";
import { restoreAppearance, storedAppearance } from "@/theme/appearance";
import { defaultDensity, densities, readDensity } from "@/theme/density";
import { applyScheme, readScheme } from "@/theme/scheme";
import { textSize } from "@/theme/text-size";
import { currentThemeValues } from "@/theme/themes";

// Spec A19, docs/specs/2026-10-29-appearance-studio-design.md.
describe("defaults", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("reads the house look from an empty storage", () => {
    expect(currentThemeValues()).toEqual({
      accent: "cyan",
      tone: "slate",
      success: "#14b8a6",
      danger: "#f97066",
      warning: "theme",
      info: "theme",
      corners: "round",
      typeface: "grotesque",
      visual: "standard",
      depth: "soft",
      step: "wide",
      borders: "subtle",
      shadows: "soft",
      chart: "spectrum",
    });
    expect(readDensity()).toBe("compact");
  });
});

describe("storedAppearance", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("holds the names present in storage", () => {
    applyScheme("light");

    expect(storedAppearance()).toEqual({ scheme: "light" });
  });
});

describe("restoreAppearance", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("stores the known names and reads a refused value as the fallback", () => {
    const density = densities.find((value) => value !== defaultDensity);

    restoreAppearance({
      scheme: "light",
      accent: "bogus",
      density,
      other: "x",
      textSize: 5,
    });

    expect(readScheme()).toBe("light");
    expect(readAccent()).toBe(defaultAccent);
    expect(readDensity()).toBe(density);
    expect(localStorage.getItem("equori.other")).toBeNull();
    expect(textSize.read()).toBe(textSize.fallback);
  });
});
