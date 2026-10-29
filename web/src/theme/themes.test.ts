import { beforeEach, describe, expect, it } from "vitest";

import { resetAppearance } from "@/theme/appearance";
import { readCorners } from "@/theme/corners";
import { readScheme } from "@/theme/scheme";
import {
  applyThemeValues,
  curatedThemes,
  currentThemeValues,
  matchTheme,
} from "@/theme/themes";
import type { SavedTheme } from "@/theme/themes";

describe("themes", () => {
  beforeEach(() => {
    localStorage.clear();
    resetAppearance();
  });

  it("reads the defaults as the equori theme", () => {
    expect(matchTheme(currentThemeValues(), [])).toBe("equori");
  });

  it("applies every value of a theme and matches it afterwards", () => {
    applyThemeValues(curatedThemes.ocean);

    expect(readCorners()).toBe("round");
    expect(
      document.documentElement.style.getPropertyValue("--slotted-seed-success"),
    ).toBe("#14b8a6");
    expect(matchTheme(currentThemeValues(), [])).toBe("ocean");
  });

  it("leaves the reading preferences as they were", () => {
    localStorage.setItem("equori.scheme", "light");

    applyThemeValues(curatedThemes.terminal);

    expect(readScheme()).toBe("light");
  });

  it("matches a preset and its hex seed as the same value", () => {
    applyThemeValues({ ...curatedThemes.equori, accent: "#7c6cff" });

    expect(matchTheme(currentThemeValues(), [])).toBe("equori");
  });

  it("matches a saved theme after the curated ones", () => {
    const saved: SavedTheme = {
      id: "b1",
      name: "Mine",
      values: { ...curatedThemes.paper, corners: "round" },
    };

    applyThemeValues(saved.values);

    expect(matchTheme(currentThemeValues(), [saved])).toBe("b1");
  });

  it("reads values no theme holds as custom", () => {
    applyThemeValues({ ...curatedThemes.forest, accent: "#123456" });

    expect(matchTheme(currentThemeValues(), [])).toBeNull();
  });
});
