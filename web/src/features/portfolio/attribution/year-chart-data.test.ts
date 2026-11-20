import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import {
  yearChartData,
  yearZoom,
} from "@/features/portfolio/attribution/year-chart-data";

type AttributionYear = components["schemas"]["AttributionYear"];

describe("yearChartData", () => {
  it("gives every year the return of the portfolio and of the rate, null where a year has none", () => {
    const years = [year(2016, -101), year(2025, 1593, 1430), year(2026)];

    expect(yearChartData(years)).toEqual([
      { year: "2016", portfolio: -101, rate: null },
      { year: "2025", portfolio: 1593, rate: 1430 },
      { year: "2026", portfolio: null, rate: null },
    ]);
  });
});

describe("yearZoom", () => {
  it("opens a long history on its last twelve years and a short one whole", () => {
    expect(yearZoom(24)).toEqual({ start: 0.5, end: 1 });
    expect(yearZoom(12)).toBeUndefined();
  });
});

function year(y: number, returnBp?: number, rateBp?: number): AttributionYear {
  const brl = { amount: 0, currency: "BRL" };

  return {
    year: y,
    from: `${String(y)}-01-01`,
    to: `${String(y)}-12-31`,
    since: `${String(y)}-01-01`,
    result: brl,
    capital: brl,
    ...(returnBp === undefined ? {} : { return_bp: returnBp }),
    other: { result: brl, weight_bp: 0, contribution_bp: 0 },
    items: [],
    ...(rateBp === undefined
      ? {}
      : {
          rate: {
            index: "cdi",
            index_bp: rateBp,
            index_result: brl,
            result: brl,
            return_bp: returnBp ?? 0,
            until: `${String(y)}-12-31`,
          },
        }),
  };
}
