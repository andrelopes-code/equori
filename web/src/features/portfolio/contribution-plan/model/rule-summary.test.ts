import { describe, expect, it } from "vitest";

import type { Rule } from "@/features/portfolio/contribution-plan/model/plan-draft";
import { ruleSummary } from "@/features/portfolio/contribution-plan/model/rule-summary";
import type { RuleWords } from "@/features/portfolio/contribution-plan/model/rule-summary";
import { catalogPtBR } from "@/i18n/catalog.pt-BR";
import type { TFunction } from "@/i18n/i18n-provider";

const t = ((key, vars) =>
  catalogPtBR[key].replace(/\{(\w+)\}/g, (_, name: string) =>
    String(vars?.[name]),
  )) satisfies TFunction;

const labels: Record<string, string> = {
  fixed_income: "Renda fixa",
  etf: "ETF",
  cdb: "CDB",
  lci: "LCI",
  inflation: "Inflação",
  rate: "Pós-fixado",
};

const label = (key: string) => labels[key] ?? key;

const words: RuleWords = {
  t,
  typeLabel: label,
  subtypeLabel: label,
  kindLabel: label,
};

const cases: { name: string; rule: Rule; want: string }[] = [
  {
    name: "type, kind and a range of years",
    rule: {
      instrument_type: "fixed_income",
      return_kind: "inflation",
      matures_from_year: 2031,
      matures_to_year: 2035,
    },
    want: "Renda fixa · Inflação · vence de 2031 a 2035",
  },
  {
    name: "daily liquidity",
    rule: { daily_liquidity: true },
    want: "liquidez diária",
  },
  {
    name: "no daily liquidity",
    rule: { daily_liquidity: false },
    want: "sem liquidez diária",
  },
  {
    name: "a type and a quote currency",
    rule: { quote_currency: "USD", instrument_type: "etf" },
    want: "ETF · em USD",
  },
  {
    name: "subtypes joined by a comma",
    rule: { instrument_type: "fixed_income", subtypes: ["cdb", "lci"] },
    want: "Renda fixa · CDB, LCI",
  },
  {
    name: "a last year only",
    rule: { matures_to_year: 2030 },
    want: "vence até 2030",
  },
  {
    name: "a first year only",
    rule: { matures_from_year: 2031 },
    want: "vence a partir de 2031",
  },
  {
    name: "government bond",
    rule: { guarantee: "sovereign" },
    want: "título público",
  },
  {
    name: "no guarantee",
    rule: { guarantee: "uncovered" },
    want: "sem garantia",
  },
];

describe("ruleSummary", () => {
  it.each(cases)("writes $name", ({ rule, want }) => {
    expect(ruleSummary(rule, { ...words, guaranteeName: "FGC" })).toBe(want);
  });

  it("names the guarantee of the book", () => {
    expect(
      ruleSummary({ guarantee: "covered" }, { ...words, guaranteeName: "FGC" }),
    ).toBe("coberto pelo FGC");
  });

  it.each(["covered", "sovereign", "uncovered"] as const)(
    "says the guarantee is unavailable without a name for %s",
    (guarantee) => {
      expect(ruleSummary({ guarantee }, words)).toBe(
        "garantia indisponível na região do livro",
      );
    },
  );

  it("keeps the order of the conditions", () => {
    const rule = {
      guarantee: "covered",
      daily_liquidity: true,
      return_kind: "rate",
      quote_currency: "BRL",
      instrument_type: "fixed_income",
    } as const;

    expect(ruleSummary(rule, { ...words, guaranteeName: "FGC" })).toBe(
      "Renda fixa · em BRL · Pós-fixado · liquidez diária · coberto pelo FGC",
    );
  });
});
