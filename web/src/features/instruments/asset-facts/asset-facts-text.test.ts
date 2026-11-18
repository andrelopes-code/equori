import { describe, expect, it } from "vitest";

import { assetFactsText } from "@/features/instruments/asset-facts/asset-facts-text";
import type { CompanyFigures } from "@/features/instruments/company-report/company-figures";
import { catalogPtBR } from "@/i18n/catalog.pt-BR";
import { formatReferenceMonth } from "@/i18n/format";
import type { TFunction } from "@/i18n/i18n-provider";

const t = ((key, vars) =>
  catalogPtBR[key].replace(/\{(\w+)\}/g, (_, name: string) =>
    String(vars?.[name]),
  )) satisfies TFunction;

const company: CompanyFigures = {
  window: "2026-09-30",
  balance: "2026-09-30",
  delivered: null,
  returnOnEquity: 0.12,
  netMargin: 0.15,
  netDebtToEquity: 0.3,
  positiveYears: { positive: 3, count: 5 },
};

describe("assetFactsText", () => {
  it("writes the figures of a fund report", () => {
    const fund = {
      priceToBook: 0.9574,
      yearYield: 0.083544,
      period: "2026-10-01",
    };
    const month = formatReferenceMonth("2026-10", "pt-BR");

    expect(assetFactsText({ fund, company: null }, t, "pt-BR")).toBe(
      `P/VP 0,96 · distribuído em 12 meses sobre o preço 8,35% · informe de ${month}`,
    );
  });

  it("writes the figures of a company report", () => {
    expect(assetFactsText({ fund: null, company }, t, "pt-BR")).toBe(
      "ROE 12,00% · margem 15,00% · dívida líquida/PL 0,30 · lucro em 3 de 5 exercícios · 12 meses até 30/09/2026",
    );
  });

  it("writes no data and does not apply for the figures of a plan other", () => {
    const other: CompanyFigures = {
      ...company,
      returnOnEquity: null,
      netMargin: "notApplicable",
      netDebtToEquity: "notApplicable",
    };

    expect(assetFactsText({ fund: null, company: other }, t, "pt-BR")).toBe(
      "ROE sem dado · margem não se aplica · dívida líquida/PL não se aplica · lucro em 3 de 5 exercícios · 12 meses até 30/09/2026",
    );
  });

  it("writes the years with profit and the window in words when they are missing", () => {
    const none: CompanyFigures = {
      ...company,
      returnOnEquity: null,
      netMargin: null,
      window: null,
      positiveYears: null,
    };

    expect(assetFactsText({ fund: null, company: none }, t, "pt-BR")).toBe(
      "ROE sem dado · margem sem dado · dívida líquida/PL 0,30 · anos com lucro sem dado · 12 meses sem dado",
    );
  });

  it("writes the absence of both reports", () => {
    expect(assetFactsText({ fund: null, company: null }, t, "pt-BR")).toBe(
      "sem informe nem demonstrações",
    );
  });
});
