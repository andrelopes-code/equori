import { describe, expect, it } from "vitest";

import {
  helpNeighbours,
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
  it("takes the heading as the title, the first paragraph as the lead and the rest as the body", () => {
    const text =
      "# Pay a statement\n\nA statement gathers.\nIt closes.\n\n## Steps\n\n1. Open.";

    expect(splitHelpPage(text)).toEqual({
      title: "Pay a statement",
      lead: "A statement gathers. It closes.",
      leadMarkdown: "A statement gathers.\nIt closes.",
      body: "## Steps\n\n1. Open.",
    });
  });
});

describe("splitHelpPage lead", () => {
  it("keeps the words of a link and drops the marks of emphasis", () => {
    const text =
      "# Title\n\nChoose **Pay**. See [The statement](/help/statement).\n\nBody.";

    expect(splitHelpPage(text).lead).toBe("Choose Pay. See The statement.");
  });
});

describe("helpNeighbours", () => {
  it("names the pages around one in the order of the index", () => {
    expect(helpNeighbours("import-statement")).toEqual({
      previous: { id: "first-month", kind: "tutorial" },
      next: { id: "pay-statement", kind: "howto" },
    });
  });

  it("names no page before the first nor after the last", () => {
    expect(helpNeighbours("first-month").previous).toBeUndefined();
    expect(helpNeighbours("bank-connections").next).toBeUndefined();
  });

  it("names nothing for an unknown page", () => {
    expect(helpNeighbours("nope")).toEqual({});
  });
});
