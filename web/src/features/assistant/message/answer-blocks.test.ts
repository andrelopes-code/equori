import { describe, expect, it } from "vitest";

import { parseAnswer } from "@/features/assistant/message/answer-markdown";
import {
  answerSegments,
  parseAmount,
  parseDay,
} from "@/features/assistant/message/answer-blocks";

describe("parseAmount", () => {
  it.each([
    {
      name: "pt-BR",
      text: "R$ 1.284,50",
      locale: "pt-BR",
      value: 1284.5,
      marker: "R$",
    },
    {
      name: "minus sign",
      text: "−R$ 42,90",
      locale: "pt-BR",
      value: -42.9,
      marker: "R$",
    },
    {
      name: "hyphen",
      text: "-R$ 42,90",
      locale: "pt-BR",
      value: -42.9,
      marker: "R$",
    },
    { name: "en", text: "$1,284.50", locale: "en", value: 1284.5, marker: "$" },
    { name: "no marker", text: "30", locale: "pt-BR", value: 30, marker: "" },
    {
      name: "trailing code",
      text: "42,90 BRL",
      locale: "pt-BR",
      value: 42.9,
      marker: "BRL",
    },
  ])("parses $name", ({ text, locale, value, marker }) => {
    expect(parseAmount(text, locale)).toEqual({ value, marker });
  });

  it.each(["iFood", "18%", "R$ 1.284,50 e R$ 3,00"])("rejects %s", (text) => {
    expect(parseAmount(text, "pt-BR")).toBeUndefined();
  });
});

describe("parseDay", () => {
  it.each([
    { text: "22/11", locale: "pt-BR", expected: { month: 11, day: 22 } },
    {
      text: "22/11/2026",
      locale: "pt-BR",
      expected: { year: 2026, month: 11, day: 22 },
    },
    {
      text: "2026-11-22",
      locale: "pt-BR",
      expected: { year: 2026, month: 11, day: 22 },
    },
    { text: "11/22", locale: "en", expected: { month: 11, day: 22 } },
  ])("parses $text in $locale", ({ text, locale, expected }) => {
    expect(parseDay(text, locale)).toEqual(expected);
  });

  it.each(["Setembro", "31/02", "R$ 10,00"])("rejects %s", (text) => {
    expect(parseDay(text, "pt-BR")).toBeUndefined();
  });
});

describe("answerSegments", () => {
  it("turns a two-row table into a comparison between its paragraphs", () => {
    const segments = answerSegments(
      parseAnswer(
        [
          "Antes.",
          "",
          "| Mês | Valor |",
          "| --- | --- |",
          "| Setembro | R$ 1.088,20 |",
          "| Outubro | R$ 1.284,50 |",
          "",
          "Depois.",
        ].join("\n"),
      ),
      "pt-BR",
    );

    expect(segments.map((s) => s.kind)).toEqual([
      "markdown",
      "compare",
      "markdown",
    ]);
    expect(segments[1]).toEqual({
      kind: "compare",
      head: ["Mês", "Valor"],
      rows: [
        { label: "Setembro", text: "R$ 1.088,20", value: 1088.2 },
        { label: "Outubro", text: "R$ 1.284,50", value: 1284.5 },
      ],
    });
  });

  it.each([
    {
      name: "ranking numbered",
      values: ["R$ 612,40", "R$ 389,00", "R$ 283,10", "R$ 0,00"],
      numbered: true,
    },
    {
      name: "ranking not numbered",
      values: ["10", "30", "20"],
      numbered: false,
    },
  ])("draws a $name", ({ values, numbered }) => {
    const rows = values.map((v, i) => `| Item ${String(i)} | ${v} |`);
    const segments = answerSegments(table("Item", "Valor", rows), "pt-BR");

    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({ kind: "ranking", numbered });
  });

  it("draws a series with the days since the first row", () => {
    const segments = answerSegments(
      table("Data", "Saldo", [
        "| 15/11 | R$ 3.517,10 |",
        "| 17/11 | R$ 598,72 |",
        "| 22/11 | R$ 340,10 |",
      ]),
      "pt-BR",
    );

    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({
      kind: "series",
      head: ["Data", "Saldo"],
    });
    const series = segments[0];
    expect(
      series?.kind === "series" ? series.rows.map((r) => r.day) : [],
    ).toEqual([0, 2, 7]);
  });

  it("takes the year of the previous row for a row without one", () => {
    const segments = answerSegments(
      table("Data", "Saldo", [
        "| 20/11/2026 | R$ 10,00 |",
        "| 22/11 | R$ 20,00 |",
        "| 30/11 | R$ 15,00 |",
      ]),
      "pt-BR",
    );

    const series = segments[0];
    expect(series?.kind).toBe("series");
    expect(
      series?.kind === "series" ? series.rows.map((r) => r.day) : [],
    ).toEqual([0, 2, 10]);
  });

  it.each([
    {
      name: "a ranking with a negative value",
      rows: ["| A | R$ 10,00 |", "| B | −R$ 5,00 |", "| C | R$ 3,00 |"],
      columns: 2,
    },
    {
      name: "mixed markers",
      rows: ["| A | R$ 10,00 |", "| B | US$ 5,00 |", "| C | R$ 3,00 |"],
      columns: 2,
    },
    {
      name: "dates out of order",
      rows: [
        "| 17/11 | −R$ 10,00 |",
        "| 15/11 | R$ 5,00 |",
        "| 22/11 | R$ 3,00 |",
      ],
      columns: 2,
    },
    {
      name: "a text cell",
      rows: ["| A | iFood |", "| B | R$ 5,00 |"],
      columns: 2,
    },
    {
      name: "three columns",
      rows: ["| A | R$ 10,00 | x |", "| B | R$ 5,00 | y |"],
      columns: 3,
    },
  ])("keeps $name as markdown", ({ rows, columns }) => {
    const head =
      columns === 3 ? table("A", "B | C", rows) : table("A", "B", rows);
    const segments = answerSegments(head, "pt-BR");

    expect(segments.map((s) => s.kind)).toEqual(["markdown"]);
  });
});

function table(
  first: string,
  second: string,
  rows: string[],
): ReturnType<typeof parseAnswer> {
  const columns = second.includes("|") ? 3 : 2;
  const rule = Array.from({ length: columns }, () => "---").join(" | ");

  return parseAnswer(
    [`| ${first} | ${second} |`, `| ${rule} |`, ...rows].join("\n"),
  );
}
