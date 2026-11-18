import { describe, expect, it } from "vitest";

import type { MarketCurve } from "@/features/calculators/api";
import { marketFigure } from "@/features/calculators/indexer-comparison/market-view";

const points = (rate: number) => [
  { maturity: "2028-01-01", rate },
  { maturity: "2030-01-01", rate: rate + 0.006 },
];

const nominal: MarketCurve = {
  id: "br_tesouro_prefixed",
  kind: "nominal",
  index: null,
  currency: "BRL",
  baseDate: "2026-11-16",
  points: points(0.128),
};

const real: MarketCurve = {
  id: "br_tesouro_ipca",
  kind: "real",
  index: "ipca",
  currency: "BRL",
  baseDate: "2026-11-13",
  points: points(0.07),
};

describe("marketFigure", () => {
  it("reads the nominal curve for a daily index", () => {
    const got = marketFigure(
      [nominal],
      { id: "cdi", period: "day" },
      "BRL",
      "2029-01-01",
    );

    expect(got?.rate).toBeCloseTo(0.131004, 6);
    expect(got?.date).toBe("2026-11-16");
  });

  it("gives the implied inflation for a monthly index, dated by the older curve", () => {
    const got = marketFigure(
      [nominal, real],
      { id: "ipca", period: "month" },
      "BRL",
      "2029-01-01",
    );

    // (1.131004 / 1.073004) - 1, the real curve rising by the same 0.6 points.
    expect(got?.rate).toBeCloseTo(0.054054, 5);
    expect(got?.date).toBe("2026-11-13");
  });

  it.each([
    ["without a real curve", [nominal], "ipca", "BRL", "2029-01-01"],
    ["of another currency", [nominal], "cdi", "USD", "2029-01-01"],
    ["outside the points", [nominal], "cdi", "BRL", "2031-01-01"],
    ["without curves", [], "cdi", "BRL", "2029-01-01"],
  ] as const)("is null %s", (_name, curves, id, currency, maturity) => {
    const period = id === "ipca" ? "month" : "day";

    expect(marketFigure(curves, { id, period }, currency, maturity)).toBeNull();
  });
});
