import { describe, expect, it } from "vitest";

import { pricesInZoom } from "@/features/instruments/model/zoom-window";

const price = (date: string, value: string) => ({
  instrument: "PETR4",
  quote_instrument: "BRL",
  date,
  value,
  source: "b3_cotahist",
});

// Ten days apart: 0, 10 and 20 days into the domain.
const prices = [
  price("2026-10-21", "30.00"),
  price("2026-10-01", "10.00"),
  price("2026-10-11", "20.00"),
];

describe("pricesInZoom", () => {
  it("keeps every price when the zoom shows the whole domain", () => {
    const shown = pricesInZoom(prices, { start: 0, end: 1 });

    expect(shown.map((p) => p.date)).toEqual([
      "2026-10-01",
      "2026-10-11",
      "2026-10-21",
    ]);
  });

  it("keeps the prices from the start to the end of the window, ends included", () => {
    const shown = pricesInZoom(prices, { start: 0.5, end: 1 });

    expect(shown.map((p) => p.date)).toEqual(["2026-10-11", "2026-10-21"]);
  });

  it("drops the prices outside a window in the middle", () => {
    const shown = pricesInZoom(prices, { start: 0.25, end: 0.75 });

    expect(shown.map((p) => p.date)).toEqual(["2026-10-11"]);
  });

  it("returns nothing for an empty series", () => {
    expect(pricesInZoom([], { start: 0, end: 1 })).toEqual([]);
  });
});
