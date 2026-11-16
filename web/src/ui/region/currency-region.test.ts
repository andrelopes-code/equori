import { describe, expect, it } from "vitest";

import { currencyRegion } from "@/ui/region/currency-region";

describe("currencyRegion", () => {
  it.each([
    ["BRL", "BR"],
    ["USD", "US"],
    ["GBP", "GB"],
    ["CHF", "CH"],
  ])("takes the country of %s from its first two letters", (code, region) => {
    expect(currencyRegion(code)).toBe(region);
  });

  it("names the euro area for the euro", () => {
    expect(currencyRegion("EUR")).toBe("EU");
  });

  it.each(["XOF", "XAF", "XPF", "XCD"])(
    "has no region for the shared currency %s",
    (code) => {
      expect(currencyRegion(code)).toBeNull();
    },
  );

  it("has no region for a code whose first two letters are no region", () => {
    expect(currencyRegion("ANG")).toBeNull();
  });
});
