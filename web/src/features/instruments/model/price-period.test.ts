import { describe, expect, it } from "vitest";

import { pricesBetween } from "@/features/instruments/model/price-period";

const price = (date: string, value: string) => ({
  instrument: "PETR4",
  quote_instrument: "BRL",
  date,
  value,
  source: "b3_cotahist",
});

const prices = [
  price("2026-10-21", "30.00"),
  price("2026-10-01", "10.00"),
  price("2026-10-11", "20.00"),
];

describe("pricesBetween", () => {
  it("keeps every price without a period", () => {
    expect(pricesBetween(prices, null)).toEqual(prices);
  });

  it("keeps the prices from the first to the last date, ends included", () => {
    const shown = pricesBetween(prices, {
      from: "2026-10-01",
      to: "2026-10-11",
    });

    expect(shown.map((p) => p.date)).toEqual(["2026-10-01", "2026-10-11"]);
  });

  it("reads a period dragged from right to left", () => {
    const shown = pricesBetween(prices, {
      from: "2026-10-21",
      to: "2026-10-11",
    });

    expect(shown.map((p) => p.date)).toEqual(["2026-10-11", "2026-10-21"]);
  });

  it("keeps one price when both ends are the same date", () => {
    const shown = pricesBetween(prices, {
      from: "2026-10-11",
      to: "2026-10-11",
    });

    expect(shown.map((p) => p.date)).toEqual(["2026-10-11"]);
  });
});
