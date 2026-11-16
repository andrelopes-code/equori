import { describe, expect, it } from "vitest";

import { indicatorFigures } from "@/features/accounts/institution/indicator-figures";
import type { components } from "@/api/schema.gen";

type Indicators = components["schemas"]["InstitutionIndicators"];
type Period = components["schemas"]["InstitutionPeriod"];

const june: Period = {
  period: "2026-06-30",
  basel: "0.1550912564",
  principal_capital: "0.1175995987",
  fixed_asset: "0.0510180761",
  equity: 2334461071736,
  net_income: 409304022539,
};

const march: Period = {
  period: "2026-03-31",
  basel: null,
  principal_capital: "0.1100000000",
  fixed_asset: "0.0400000000",
  equity: 2100000000050,
  net_income: 142054059415,
};

const december: Period = {
  ...march,
  period: "2025-12-31",
  basel: "0.1400000000",
};

function indicators(...periods: Period[]): Indicators {
  return {
    source: "br_ifdata",
    source_url: "https://www3.bcb.gov.br/ifdata/",
    currency: "BRL",
    conglomerate_code: "C0084693",
    conglomerate_name: "NU PAGAMENTOS - PRUDENCIAL",
    limits: {
      basel: { minimum: "0.08", with_buffer: "0.105" },
      principal_capital: { minimum: "0.045", with_buffer: "0.07" },
      rule: "Resolução CMN 4.958/2021",
    },
    periods,
  };
}

describe("indicatorFigures", () => {
  it("reads the newest period as basis points and money of the record currency", () => {
    const figures = indicatorFigures(indicators(june, march));

    expect(figures[0]).toMatchObject({
      id: "basel",
      kind: "ratio",
      basisPoints: 1551,
    });
    expect(figures[1]).toMatchObject({
      id: "principalCapital",
      basisPoints: 1176,
    });
    expect(figures[2]).toMatchObject({ id: "fixedAsset", basisPoints: 510 });
    expect(figures[3]).toMatchObject({
      id: "equity",
      kind: "amount",
      money: { amount: 2334461071736, currency: "BRL" },
    });
    expect(figures[4]).toMatchObject({
      id: "netIncome",
      money: { amount: 409304022539, currency: "BRL" },
    });
  });

  it("lists the trend oldest first and leaves a null out, never as zero", () => {
    const figures = indicatorFigures(indicators(june, march, december));

    // March has a null Basel index: two points remain, December then June.
    expect(figures[0]?.trend).toEqual([1400, 1551]);
    expect(figures[3]?.trend).toEqual([
      2100000000050, 2100000000050, 2334461071736,
    ]);
  });

  it("keeps a value the source does not inform as null", () => {
    const figures = indicatorFigures(indicators(march));

    expect(figures[0]).toMatchObject({ id: "basel", basisPoints: null });
    expect(figures[0]?.trend).toEqual([]);
  });

  it("marks a ratio below its minimum as danger and below the minimum with the buffer as warning", () => {
    const low = (basel: string, capital: string) =>
      indicatorFigures(
        indicators({ ...june, basel, principal_capital: capital }),
      );

    expect(low("0.0799", "0.0449")[0]?.attention).toBe("danger");
    expect(low("0.0799", "0.0449")[1]?.attention).toBe("danger");
    expect(low("0.0900", "0.0600")[0]?.attention).toBe("warning");
    expect(low("0.0900", "0.0600")[1]?.attention).toBe("warning");
    expect(low("0.1200", "0.0800")[0]?.attention).toBeUndefined();
    expect(low("0.1200", "0.0800")[1]?.attention).toBeUndefined();
  });

  it("compares the basis points the screen writes: a figure shown equal to a floor is not below it", () => {
    const figures = indicatorFigures(
      indicators({ ...june, basel: "0.10499", principal_capital: "0.0800" }),
    );

    // 0.10499 is written 10.50%, the floor with the buffer.
    expect(figures[0]?.attention).toBeUndefined();
  });

  it("gives the fixed-asset ratio, the equity and the net income no floor and no attention", () => {
    const figures = indicatorFigures(
      indicators({ ...june, fixed_asset: "0.9", net_income: -100 }),
    );

    expect(figures[2]?.attention).toBeUndefined();
    expect(figures[3]?.attention).toBeUndefined();
    expect(figures[4]?.attention).toBeUndefined();
  });

  it("gives a ratio the source does not inform no attention", () => {
    expect(indicatorFigures(indicators(march))[0]?.attention).toBeUndefined();
  });

  it("carries the floors written as basis points for the note", () => {
    const figures = indicatorFigures(indicators(june));

    expect(figures[0]?.floor).toEqual({ minimum: 800, withBuffer: 1050 });
    expect(figures[1]?.floor).toEqual({ minimum: 450, withBuffer: 700 });
    expect(figures[2]?.floor).toBeUndefined();
  });
});
