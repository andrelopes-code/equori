import { describe, expect, it } from "vitest";

import { parseHelpPage, slug } from "@/features/help/model/parse-help-page";

const page = `# Pay a statement

A statement gathers the purchases of a [card](/cards) cycle.

What each number means is in [The statement screen](/help/statement).

## Record the payment

![Video: the payment from start to end](pay-statement.webm)

1. Open the card in [Cards](/cards).
   ![The list of cards](pay-cards)
2. Choose **Pay**.

The payment leaves the account.

## The total differs {#statement-differs}

A purchase entered the wrong cycle.

1. Open the statement.

![The statement page](statement-total "The total stands at the top.")

More: [The statement screen](/help/statement).
`;

describe("parseHelpPage", () => {
  it("reads the title, the lead and the blocks before the first section", () => {
    const doc = parseHelpPage(page);

    expect(doc.title).toBe("Pay a statement");
    expect(doc.lead).toBe("A statement gathers the purchases of a card cycle.");
    expect(doc.leadMarkdown).toBe(
      "A statement gathers the purchases of a [card](/cards) cycle.",
    );
    expect(doc.intro).toEqual([
      {
        type: "text",
        markdown:
          "What each number means is in [The statement screen](/help/statement).",
      },
    ]);
  });

  it("names a section by its written id, or by the slug of its title", () => {
    const doc = parseHelpPage(page);

    expect(doc.sections.map((s) => [s.id, s.title, s.written])).toEqual([
      ["record-the-payment", "Record the payment", false],
      ["statement-differs", "The total differs", true],
    ]);
  });

  it("reads an ordered list as steps, with the figure of a step and the video", () => {
    const [first] = parseHelpPage(page).sections;

    expect(first?.blocks).toEqual([
      {
        type: "steps",
        video: {
          id: "pay-statement",
          alt: "Video: the payment from start to end",
          caption: "",
        },
        steps: [
          {
            markdown: "Open the card in [Cards](/cards).",
            figure: { id: "pay-cards", alt: "The list of cards", caption: "" },
          },
          { markdown: "Choose **Pay**." },
        ],
      },
      { type: "text", markdown: "The payment leaves the account." },
    ]);
  });

  it("reads a figure with its caption and the pointer that ends a section", () => {
    const [, second] = parseHelpPage(page).sections;

    expect(second?.blocks).toEqual([
      { type: "text", markdown: "A purchase entered the wrong cycle." },
      { type: "steps", steps: [{ markdown: "Open the statement." }] },
      {
        type: "figure",
        figure: {
          id: "statement-total",
          alt: "The statement page",
          caption: "The total stands at the top.",
        },
      },
      {
        type: "pointer",
        markdown: "[The statement screen](/help/statement).",
      },
    ]);
  });

  it("reads a glossary paragraph as a term", () => {
    const doc = parseHelpPage(
      "# Glossary\n\nThe terms.\n\n**Minimum payment**: the least the institution accepts.",
    );

    expect(doc.intro).toEqual([
      {
        type: "term",
        id: "minimum-payment",
        term: "Minimum payment",
        markdown: "the least the institution accepts.",
      },
    ]);
  });

  it("keeps a fenced block with a blank line and the text around it in one block", () => {
    const doc = parseHelpPage(
      "# Install\n\nLead.\n\n## Run\n\nType:\n\n```sh\nmake db-up\n\nmake dev\n```\n\nDone.",
    );

    expect(doc.sections[0]?.blocks).toEqual([
      {
        type: "text",
        markdown: "Type:\n\n```sh\nmake db-up\n\nmake dev\n```\n\nDone.",
      },
    ]);
  });
});

describe("slug", () => {
  it("keeps letters with diacritics and joins words with a hyphen", () => {
    expect(slug("2. Registre o que entrou e saiu")).toBe(
      "2-registre-o-que-entrou-e-saiu",
    );
    expect(slug("Conferir com a instituição")).toBe(
      "conferir-com-a-instituição",
    );
  });
});
