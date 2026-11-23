import { describe, expect, it } from "vitest";

import { numfmtLocale } from "@/features/spreadsheets/editor/numfmt-locale";

describe("numfmtLocale", () => {
  it.each([
    ["pt-BR", "pt_BR"],
    ["pt-PT", "pt"],
    ["en-US", "en"],
    ["en-GB", "en_GB"],
    ["de-DE", "de"],
    ["de-CH", "de_CH"],
    ["en", "en"],
    ["xx-YY", "en"],
    ["", "en"],
  ])("reads %s as %s", (tag, want) => {
    expect(numfmtLocale(tag)).toBe(want);
  });
});
