import { beforeAll, describe, expect, it } from "vitest";

import { loadHelpLibrary } from "@/features/help/model/help-library";
import type { HelpLibrary } from "@/features/help/model/help-library";
import { catalogEn } from "@/i18n/catalog.en";
import { catalogPtBR } from "@/i18n/catalog.pt-BR";
import { hitRanges, searchHelp } from "@/features/help/search/search-help";

let library: HelpLibrary;

beforeAll(async () => {
  library = await loadHelpLibrary("pt", "BR");
});

describe("searchHelp", () => {
  it("answers an empty query with nothing", () => {
    expect(searchHelp(library, "  ")).toEqual({
      query: "",
      best: null,
      groups: [],
      count: 0,
      near: [],
    });
  });

  it("puts the page whose title matches first, then sections, terms and text", () => {
    const result = searchHelp(library, "fatura");

    expect(result.best?.title).toBe("Pagar uma fatura");
    expect(result.best?.page).toBe("pay-statement");
    expect(result.groups.map((g) => g.group)).toEqual([
      "pages",
      "sections",
      "terms",
    ]);
    expect(result.groups[0]?.hits.map((h) => h.title)).toEqual([
      "A tela da fatura",
    ]);
    expect(result.groups[2]?.hits[0]?.title).toBe("Fatura");
    expect(result.count).toBe(
      1 + result.groups.reduce((sum, g) => sum + g.hits.length, 0),
    );
  });

  it("lists a section title that matches before a section whose text matches", () => {
    const result = searchHelp(library, "parcelas");

    expect(result.best).toMatchObject({
      group: "sections",
      title: "Pagar em parcelas",
      page: "pay-statement",
      hash: "pagar-em-parcelas",
      pageTitle: "Pagar uma fatura",
    });
  });

  it("ignores case and diacritics", () => {
    expect(searchHelp(library, "GLOSSARIO").best?.page).toBe("glossary");
    expect(searchHelp(library, "instituicao").count).toBeGreaterThan(0);
  });

  it("accepts one changed letter in a word of five letters or more", () => {
    expect(searchHelp(library, "fatira").best?.title).toBe("Pagar uma fatura");
    expect(searchHelp(library, "meta").best?.title).toBe("Meta");
    expect(searchHelp(library, "mita").count).toBe(0);
  });

  it("needs every word of the query in one entry", () => {
    const result = searchHelp(library, "pagar fatura");

    expect(result.best?.title).toBe("Pagar uma fatura");
    expect(
      result.groups.flatMap((g) => g.hits).map((h) => h.title),
    ).not.toContain("Fatura");
  });

  it("does not repeat in the text group a page listed by its title", () => {
    const result = searchHelp(library, "fatura");
    const pages = result.groups
      .flatMap((g) => g.hits)
      .filter((h) => h.group === "text")
      .map((h) => h.page);

    expect(pages).not.toContain("pay-statement");
    expect(pages).not.toContain("statement");
  });

  it("answers a query without result with the entries that match one word", () => {
    const result = searchHelp(library, "pix parcelado");

    expect(result.count).toBe(0);
    expect(result.best).toBeNull();
    expect(result.near.length).toBeGreaterThan(0);
    expect(result.near.length).toBeLessThanOrEqual(3);
  });

  it("cuts the excerpt of a text match at the sentence that holds the word", () => {
    const result = searchHelp(library, "juros");
    const hit = [result.best, ...result.groups.flatMap((g) => g.hits)].find(
      (h) => h?.title === "Pagar em parcelas",
    );

    expect(hit?.excerpt).toMatch(/juros/);
    expect(hit?.excerpt.startsWith("… ")).toBe(true);
  });
});

describe("excerpts", () => {
  it("drops the mark of a list item", async () => {
    const result = searchHelp(await loadHelpLibrary("pt", "BR"), "fatura");
    const excerpts = result.groups.flatMap((g) => g.hits).map((h) => h.excerpt);

    expect(excerpts.length).toBeGreaterThan(5);
    expect(excerpts.filter((e) => /^(… )?- /.test(e))).toEqual([]);
  });
});

describe("common searches", () => {
  it.each([
    ["pt", catalogPtBR],
    ["en", catalogEn],
  ] as const)("each finds a page in %s (HP11)", async (language, catalog) => {
    const pages = await loadHelpLibrary(language, "US");

    for (const key of [
      "help.search.common.1",
      "help.search.common.2",
      "help.search.common.3",
      "help.search.common.4",
    ] as const) {
      expect(
        searchHelp(pages, catalog[key]).count,
        catalog[key],
      ).toBeGreaterThan(0);
    }
  });
});

describe("hitRanges", () => {
  it("returns the words of a text that match the query", () => {
    expect(hitRanges("A Fatura e a instituição", "fatura instituicao")).toEqual(
      [
        [2, 8],
        [13, 24],
      ],
    );
  });
});
