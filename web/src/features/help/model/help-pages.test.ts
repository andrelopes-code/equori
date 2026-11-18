import { describe, expect, it, vi } from "vitest";

import { helpFigure, helpVideo } from "@/features/help/media/help-media";
import { helpGuides } from "@/features/help/model/help-guides";
import {
  loadHelpLibrary,
  symptomsOf,
} from "@/features/help/model/help-library";
import {
  helpNeighbours,
  helpPages,
  loadHelpPage,
  splitHelpPage,
} from "@/features/help/model/help-pages";
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

  it("holds the pages of the first-use help with their kinds (S249)", () => {
    expect(helpPages).toEqual(
      expect.arrayContaining([
        { id: "installation", kind: "howto" },
        { id: "connect-bank", kind: "howto" },
        { id: "troubleshooting", kind: "reference" },
      ]),
    );
  });

  it.each(languages.map((l) => l.language))(
    "gives troubleshooting an entry of its own for each symptom in %s (S249)",
    async (language) => {
      const text = await loadHelpPage(language, "US", "troubleshooting");

      expect(text?.match(/^## \S/gm)?.length ?? 0).toBeGreaterThanOrEqual(9);
    },
  );

  it.each(["connect-bank", "troubleshooting"])(
    "adds the passage of region BR to %s and none for US (S250)",
    async (id) => {
      const neutral = await loadHelpPage("en", "US", id);
      const brazil = await loadHelpPage("en", "BR", id);

      expect(neutral).not.toBeNull();
      expect(neutral).not.toContain("Meu Pluggy");
      expect(brazil?.startsWith(neutral ?? "")).toBe(true);
      expect(brazil).toContain("Meu Pluggy");
    },
  );

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

  // Spec 2026-11-17-help-design, HP7: the index lists a page under its area.
  it("gives every page an area, but the walkthrough, the glossary and the symptoms", () => {
    const without = helpPages.filter(
      (p) => helpGuides[p.id]?.area === undefined,
    );

    expect(without.map((p) => p.id)).toEqual([
      "first-month",
      "glossary",
      "troubleshooting",
    ]);
  });

  it.each(languages.map((l) => l.language))(
    "names in %s only symptoms and related pages that exist",
    async (language) => {
      const library = await loadHelpLibrary(language, "US");
      const symptoms = symptomsOf(library).map((s) => s.id);

      expect(symptoms).toHaveLength(10);

      for (const page of helpPages) {
        const guide = helpGuides[page.id];

        for (const id of guide?.symptoms ?? []) {
          expect(symptoms, page.id).toContain(id);
        }

        for (const id of guide?.related ?? []) {
          expect(
            helpPages.map((p) => p.id),
            page.id,
          ).toContain(id);
        }
      }
    },
  );

  it.each(languages.map((l) => l.language))(
    "holds the files of every figure and video a page of %s names",
    async (language) => {
      const library = await loadHelpLibrary(language, "US");
      const blocks = library.flatMap((page) => [
        ...page.document.intro,
        ...page.document.sections.flatMap((s) => s.blocks),
      ]);
      const figures = blocks.flatMap((block) => {
        if (block.type === "figure") return [block.figure.id];
        if (block.type !== "steps") return [];

        return block.steps.flatMap((s) => (s.figure ? [s.figure.id] : []));
      });
      const videos = blocks.flatMap((block) =>
        block.type === "steps" && block.video ? [block.video.id] : [],
      );

      // The media shipped (help spec, section 6).
      expect(figures).toContain("pay-amount");
      expect(videos).toEqual([
        "import-statement",
        "pay-statement",
        "check-balance",
        "category-rule",
      ]);
      // jsdom plays no media; a browser that does not play the video gets none.
      vi.spyOn(HTMLMediaElement.prototype, "canPlayType").mockReturnValue(
        "probably",
      );

      for (const id of figures) {
        const figure = helpFigure(id, language);

        // Each language has its own captures (tools/help-media): none borrows another's.
        expect(figure?.dark, id).toContain(`${id}.${language}.dark`);
        expect(figure?.light, id).toContain(`${id}.${language}.light`);
        expect(figure?.spot, id).toHaveLength(4);
      }

      for (const id of videos) {
        expect(helpVideo(id, language)?.dark, id).toContain(
          `${id}.${language}.dark`,
        );
        expect(helpVideo(id, language)?.seconds, id).toBeGreaterThan(0);
      }
    },
  );
});
