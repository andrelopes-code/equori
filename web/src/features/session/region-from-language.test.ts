import { describe, expect, it } from "vitest";

import { regionFromLanguage } from "@/features/session/region-from-language";

describe("regionFromLanguage", () => {
  it.each([
    ["pt-BR", "BR"],
    ["en", null],
    ["es-419", null],
    ["zh-Hant-TW", "TW"],
    ["en-ZZ", null],
  ])("%s gives %s", (tag, expected) => {
    expect(regionFromLanguage(tag)).toBe(expected);
  });
});
