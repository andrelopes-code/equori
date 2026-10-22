import { describe, expect, it } from "vitest";

import { languages, matchLanguage } from "@/i18n/languages";

describe("matchLanguage", () => {
  it.each([
    [["pt-PT", "en"], "pt"],
    [["de-DE"], "en"],
    [["de-DE", "PT-br"], "pt"],
    [[], "en"],
  ])("matches %j to %s", (tags, expected) => {
    expect(matchLanguage(tags)).toBe(expected);
  });
});

describe("languages", () => {
  it("lists English and Português by native name", () => {
    expect(languages.map((l) => l.nativeName)).toEqual([
      "English",
      "Português",
    ]);
  });
});
