import { describe, expect, it } from "vitest";

import { adjustedPrices } from "@/features/instruments/model/adjusted-prices";

const price = (date: string, value: string, adjusted?: string) => ({
  instrument: "SBSP3",
  quote_instrument: "BRL",
  date,
  value,
  source: "b3_cotahist",
  ...(adjusted === undefined ? {} : { adjusted }),
});

describe("adjustedPrices", () => {
  it("reads the adjusted value of a price before a split and the close of any other", () => {
    const prices = [
      price("2026-04-28", "170", "34"),
      price("2026-04-29", "33.97"),
    ];

    expect(adjustedPrices(prices).map((p) => p.value)).toEqual(["34", "33.97"]);
    expect(prices[0]?.value).toBe("170");
  });
});
