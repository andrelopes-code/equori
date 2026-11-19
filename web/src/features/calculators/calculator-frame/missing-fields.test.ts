import { describe, expect, it } from "vitest";

import {
  lowerFirst,
  missingSentence,
} from "@/features/calculators/calculator-frame/missing-fields";
import { catalogEn } from "@/i18n/catalog.en";
import { catalogPtBR } from "@/i18n/catalog.pt-BR";
import type { TFunction } from "@/i18n/i18n-provider";

const tPt: TFunction = (key, vars) =>
  catalogPtBR[key].replace(/\{(\w+)\}/g, (_, name: string) =>
    String(vars?.[name]),
  );
const tEn: TFunction = (key, vars) =>
  catalogEn[key].replace(/\{(\w+)\}/g, (_, name: string) =>
    String(vars?.[name]),
  );

describe("missingSentence", () => {
  const present = { label: "valor financiado", missing: false };
  const amount = { label: "valor financiado", missing: true };
  const rate = { label: "taxa de juros", missing: true };
  const months = { label: "prazo", missing: true };

  const cases = [
    {
      name: "all present",
      fields: [present, { label: "prazo", missing: false }],
      t: tPt,
      tag: "pt-BR",
      want: null,
    },
    {
      name: "two missing",
      fields: [amount, { label: "taxa de juros", missing: false }, months],
      t: tPt,
      tag: "pt-BR",
      want: "Preencha valor financiado e prazo para ver a prestação.",
    },
    {
      name: "three missing",
      fields: [amount, rate, months],
      t: tPt,
      tag: "pt-BR",
      want: "Preencha valor financiado, taxa de juros e prazo para ver a prestação.",
    },
    {
      name: "invalid rate is named",
      fields: [present, rate, { label: "prazo", missing: false }],
      t: tPt,
      tag: "pt-BR",
      want: "Preencha taxa de juros para ver a prestação.",
    },
    {
      name: "english",
      fields: [
        { label: "amount", missing: true },
        { label: "rate", missing: true },
        { label: "term", missing: true },
      ],
      t: tEn,
      tag: "en",
      want: "Fill in amount, rate, and term to see the payment.",
    },
  ];

  it.each(cases)("$name", ({ fields, t, tag, want }) => {
    const what = tag === "en" ? "the payment" : "a prestação";

    expect(missingSentence(fields, what, t, tag)).toBe(want);
  });
});

describe("lowerFirst", () => {
  it.each([
    { label: "Taxa CDI", tag: "pt-BR", want: "taxa CDI" },
    { label: "IPCA rate", tag: "en", want: "IPCA rate" },
    { label: "Prazo", tag: "pt-BR", want: "prazo" },
    { label: "Term", tag: "en", want: "term" },
    { label: "", tag: "en", want: "" },
  ])("$label in $tag", ({ label, tag, want }) => {
    expect(lowerFirst(label, tag)).toBe(want);
  });
});
