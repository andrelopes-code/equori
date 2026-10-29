import { beforeEach, describe, expect, it } from "vitest";

import {
  exportTheme,
  parseTheme,
  readSavedThemes,
  writeSavedThemes,
} from "@/theme/theme-file";
import { curatedThemes } from "@/theme/themes";

describe("theme file", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("reads back an exported theme with its presets", () => {
    const text = exportTheme("Ocean", curatedThemes.ocean);

    expect(JSON.parse(text)).toMatchObject({
      format: "equori.theme",
      version: 1,
      name: "Ocean",
      accent: "#06b6d4",
      tone: "#64748b",
    });
    expect(parseTheme(text)).toEqual({
      name: "Ocean",
      values: curatedThemes.ocean,
    });
  });

  it.each([
    ["text that is not JSON", "{"],
    ["another format", JSON.stringify({ format: "other", version: 1 })],
    [
      "a later version",
      exportTheme("A", curatedThemes.equori).replace(
        '"version": 1',
        '"version": 2',
      ),
    ],
    [
      "a colour that is not hex",
      exportTheme("A", curatedThemes.equori).replace(
        '"#7c6cff"',
        '"red; background: url(x)"',
      ),
    ],
    [
      "a typeface name with a quote",
      exportTheme("A", { ...curatedThemes.equori, typeface: "geist" }).replace(
        '"geist"',
        '"custom:a\\" b"',
      ),
    ],
    [
      "a name longer than 40 characters",
      exportTheme("x".repeat(41), curatedThemes.equori),
    ],
    ["more than 4096 characters", " ".repeat(4097)],
  ])("refuses %s", (_, text) => {
    expect(parseTheme(text)).toBeNull();
  });

  it("drops a malformed saved theme and keeps the others", () => {
    localStorage.setItem(
      "equori.themes",
      JSON.stringify([
        { id: "a", name: "Kept", values: curatedThemes.dusk },
        { id: "b", name: "", values: curatedThemes.dusk },
        { id: "c", name: "Broken", values: { accent: "red" } },
      ]),
    );

    expect(readSavedThemes()).toEqual([
      { id: "a", name: "Kept", values: curatedThemes.dusk },
    ]);
  });

  it("keeps at most 50 saved themes", () => {
    const many = Array.from({ length: 51 }, (_, i) => ({
      id: String(i),
      name: `T${String(i)}`,
      values: curatedThemes.equori,
    }));

    writeSavedThemes(many);

    expect(readSavedThemes()).toHaveLength(50);
  });
});
