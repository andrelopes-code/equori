import { describe, expect, it } from "vitest";

import {
  emptySentence,
  indexedRateText,
  monthlyRate,
} from "@/features/calculators/compound-calculator/compound-fields";
import { annualToMonthly } from "@/features/calculators/model/rate-math";
import { catalogPtBR } from "@/i18n/catalog.pt-BR";
import type { TFunction } from "@/i18n/i18n-provider";

describe("emptySentence", () => {
  const t: TFunction = (key, vars) =>
    catalogPtBR[key].replace(/\{(\w+)\}/g, (_, name: string) =>
      String(vars?.[name]),
    );
  const order = ["target", "term", "rate"] as const;
  const labels = { target: "Meta", term: "Prazo", rate: "Taxa de juros" };
  const sentence = (missing: Record<(typeof order)[number], boolean>) =>
    emptySentence({
      order,
      labels,
      missing,
      what: "o valor final",
      t,
      tag: "pt-BR",
    });

  it.each([
    {
      name: "names every missing input in reading order",
      missing: { target: true, term: true, rate: true },
      text: "Preencha meta, prazo e taxa de juros para ver o valor final.",
    },
    {
      name: "names one missing input",
      missing: { target: false, term: true, rate: false },
      text: "Preencha prazo para ver o valor final.",
    },
    {
      name: "is empty when nothing is missing",
      missing: { target: false, term: false, rate: false },
      text: "",
    },
  ])("$name", ({ missing, text }) => {
    expect(sentence(missing)).toBe(text);
  });

  // M5: an acronym keeps its capitals.
  it("lowercases only the first letter of a label", () => {
    expect(
      emptySentence({
        order,
        labels: { ...labels, rate: "Taxa CDI" },
        missing: { target: false, term: false, rate: true },
        what: "o valor final",
        t,
        tag: "pt-BR",
      }),
    ).toBe("Preencha taxa CDI para ver o valor final.");
  });
});

describe("indexedRateText", () => {
  it.each([
    { name: "typed text", typed: "12", indexed: false, from: null, text: "12" },
    {
      name: "empty without text",
      typed: undefined,
      indexed: false,
      from: null,
      text: "",
    },
    {
      name: "the rate of an index",
      typed: "9",
      indexed: true,
      from: { rate: 0.110021 },
      text: "11.0021",
    },
    {
      name: "empty while an index loads",
      typed: "9",
      indexed: true,
      from: null,
      text: "",
    },
  ])("$name", ({ typed, indexed, from, text }) => {
    expect(indexedRateText(typed, indexed, from)).toBe(text);
  });
});

describe("monthlyRate", () => {
  it.each([
    { name: "no rate", typed: null, period: "year", rate: null },
    {
      name: "a monthly rate as typed",
      typed: 0.01,
      period: "month",
      rate: 0.01,
    },
    {
      name: "a yearly rate as a monthly one",
      typed: 0.1,
      period: "year",
      rate: annualToMonthly(0.1),
    },
  ] as const)("$name", ({ typed, period, rate }) => {
    expect(monthlyRate(typed, period)).toBe(rate);
  });
});
