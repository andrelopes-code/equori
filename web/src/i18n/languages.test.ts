import { formatMessage } from "@slotted/core/i18n";
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

describe("Slotted pt messages", () => {
  const pt = languages.find((l) => l.language === "pt");
  const slotted = pt !== undefined && "slotted" in pt ? pt.slotted : undefined;

  // S258 (A183).
  it.each([
    [0, "Nenhum resultado"],
    [1, "1 resultado"],
    [2, "2 resultados"],
  ])("reads a count of %i as %s", (count, want) => {
    expect(
      [
        slotted?.cascader.results,
        slotted?.combobox.count,
        slotted?.commandPalette.count,
        slotted?.entityPicker.count,
        slotted?.multiSelect.count,
        slotted?.select.count,
      ].map((m) => formatMessage(m ?? "", { count }, "pt-BR")),
    ).toEqual(Array(6).fill(want));
  });
});
