import { describe, expect, it } from "vitest";

import { nextWords } from "@/features/planning/model/next-words";

describe("nextWords", () => {
  it.each([
    { iso: "2026-10-17", locale: "en", want: "today · Oct 17" },
    { iso: "2026-10-20", locale: "en", want: "in 3 days · Oct 20" },
    { iso: "2026-11-01", locale: "pt-BR", want: "em 15 dias · 1 nov" },
    { iso: "2026-12-01", locale: "en", want: "in 45 days · Dec 1" },
    { iso: "2026-12-02", locale: "en", want: "12/02/2026" },
  ])("$iso in $locale reads $want", ({ iso, locale, want }) => {
    expect(nextWords(iso, "2026-10-17", locale)).toBe(want);
  });
});
