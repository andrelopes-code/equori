import { describe, expect, it } from "vitest";

import { sourcesOf } from "@/features/instruments/model/price-filter";

const price = (date: string, source: string) => ({
  instrument: "PETR4",
  quote_instrument: "BRL",
  date,
  value: "38.10",
  source,
});

describe("sourcesOf", () => {
  it("returns each source once, in the order of the newest-first list", () => {
    const prices = [
      price("2026-10-13", "b3_cotahist"),
      price("2026-10-14", "b3_cotahist"),
      price("2026-10-16", "manual"),
    ];

    expect(sourcesOf(prices)).toEqual(["manual", "b3_cotahist"]);
  });

  it("returns an empty list for no prices", () => {
    expect(sourcesOf([])).toEqual([]);
  });
});
