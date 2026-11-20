import { describe, expect, it } from "vitest";

import {
  heightOf,
  yearScale,
} from "@/features/portfolio/attribution/year-scale";

const brl = (amount: number) => ({ amount, currency: "BRL" });

function year(
  y: number,
  returnBp?: number,
  rateBp?: number,
  inflationBp?: number,
) {
  return {
    year: y,
    from: `${String(y)}-01-01`,
    to: `${String(y)}-12-31`,
    ...(returnBp === undefined ? {} : { return_bp: returnBp }),
    ...(rateBp === undefined
      ? {}
      : {
          rate: {
            index: "cdi",
            until: `${String(y)}-12-31`,
            return_bp: returnBp ?? 0,
            result: brl(0),
            index_bp: rateBp,
            index_result: brl(0),
          },
        }),
    ...(inflationBp === undefined
      ? {}
      : {
          inflation: {
            index: "ipca",
            until: `${String(y)}-12-31`,
            return_bp: returnBp ?? 0,
            result: brl(0),
            index_bp: inflationBp,
            index_result: brl(0),
          },
        }),
  };
}

describe("yearScale", () => {
  it("spans every column and mark, with zero inside", () => {
    const scale = yearScale([year(2024, -300, 1000, 450), year(2025, 1361)]);

    expect(scale.columns).toEqual([
      { year: 2024, returnBp: -300, rateBp: 1000, inflationBp: 450 },
      { year: 2025, returnBp: 1361, rateBp: undefined, inflationBp: undefined },
    ]);
    expect([scale.low, scale.high]).toEqual([-300, 1361]);
    expect(heightOf(scale, 0)).toBeCloseTo((300 / 1661) * 100);
    expect(heightOf(scale, 1361)).toBe(100);
  });

  it("keeps zero at the bottom when every value is positive, and draws nothing on an empty axis", () => {
    expect(yearScale([year(2025, 500)]).low).toBe(0);
    expect(heightOf(yearScale([year(2025)]), 0)).toBe(0);
  });
});
