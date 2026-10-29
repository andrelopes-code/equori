import { describe, expect, it } from "vitest";

import {
  helpPages,
  loadHelpPage,
  splitHelpPage,
} from "@/features/help/help-pages";
import { languages } from "@/i18n/languages";

describe("help pages", () => {
  it.each(languages.map((l) => l.language))(
    "holds every page in %s, each opening with its title",
    async (language) => {
      for (const { id } of helpPages) {
        const text = await loadHelpPage(language, "US", id);

        expect(text, id).toMatch(/^# \S/);
      }
    },
  );

  it("adds the passage of the reader's region after the page", async () => {
    const neutral = await loadHelpPage("pt", "US", "bank-connections");
    const brazil = await loadHelpPage("pt", "BR", "bank-connections");

    expect(neutral).not.toContain("Open Finance");
    expect(brazil?.startsWith(neutral ?? "")).toBe(true);
    expect(brazil).toContain("Open Finance");
  });

  it("names no regional value in the neutral pages", async () => {
    for (const { language } of languages) {
      for (const { id } of helpPages) {
        const text = await loadHelpPage(language, "US", id);

        expect(text, id).not.toMatch(/Open Finance|Pluggy|Pix|\bR\$|\bBRL\b/);
      }
    }
  });

  it("has no page for an unknown id", async () => {
    expect(await loadHelpPage("en", "US", "nope")).toBeNull();
  });
});

describe("splitHelpPage", () => {
  it("takes the heading as the title and the first paragraph as the lead", () => {
    const text =
      "# Pay a statement\n\nA statement gathers.\nIt closes.\n\n## Steps\n\n1. Open.";

    expect(splitHelpPage(text)).toEqual({
      title: "Pay a statement",
      lead: "A statement gathers.\nIt closes.",
      body: "A statement gathers.\nIt closes.\n\n## Steps\n\n1. Open.",
    });
  });
});
