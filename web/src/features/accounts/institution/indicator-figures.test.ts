import { describe, expect, it } from "vitest";

import { indicatorFigures } from "@/features/accounts/institution/indicator-figures";
import type { components } from "@/api/schema.gen";

type Indicators = components["schemas"]["InstitutionIndicators"];

const nubank: Indicators = {
  source: "br_ifdata",
  source_url: "https://www3.bcb.gov.br/ifdata/",
  period: "2026-06-30",
  currency: "BRL",
  conglomerate_code: "C0084693",
  conglomerate_name: "NU PAGAMENTOS - PRUDENCIAL",
  basel: "0.1550912564",
  principal_capital: "0.1175995987",
  fixed_asset: "0.0510180761",
  equity: 2334461071736,
  net_income: 409304022539,
};

describe("indicatorFigures", () => {
  it("reads each ratio as basis points and each amount as money of the record currency", () => {
    expect(indicatorFigures(nubank)).toEqual([
      { id: "basel", kind: "ratio", basisPoints: 1551 },
      { id: "principalCapital", kind: "ratio", basisPoints: 1176 },
      { id: "fixedAsset", kind: "ratio", basisPoints: 510 },
      {
        id: "equity",
        kind: "amount",
        money: { amount: 2334461071736, currency: "BRL" },
      },
      {
        id: "netIncome",
        kind: "amount",
        money: { amount: 409304022539, currency: "BRL" },
      },
    ]);
  });

  it("keeps a value the source does not inform as null, never as zero", () => {
    const figures = indicatorFigures({
      ...nubank,
      basel: null,
      equity: null,
      net_income: null,
    });

    expect(figures[0]).toEqual({
      id: "basel",
      kind: "ratio",
      basisPoints: null,
    });
    expect(figures[3]).toEqual({ id: "equity", kind: "amount", money: null });
    expect(figures[4]).toEqual({
      id: "netIncome",
      kind: "amount",
      money: null,
    });
  });

  it("keeps the sign of a negative ratio and a reported zero", () => {
    const figures = indicatorFigures({
      ...nubank,
      basel: "-0.0123456789",
      fixed_asset: "0.0000000000",
    });

    expect(figures[0]).toMatchObject({ basisPoints: -123 });
    expect(figures[2]).toMatchObject({ basisPoints: 0 });
  });
});
