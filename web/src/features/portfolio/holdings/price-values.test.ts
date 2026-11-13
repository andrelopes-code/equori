import { expect, it } from "vitest";

import { priceValues } from "@/features/portfolio/holdings/price-values";

it("orders the values by date", () => {
  expect(
    priceValues([
      { date: "2026-10-01", value: "12.5" },
      { date: "2026-08-01", value: "10" },
      { date: "2026-09-01", value: "11" },
    ]),
  ).toEqual([10, 11, 12.5]);
});
