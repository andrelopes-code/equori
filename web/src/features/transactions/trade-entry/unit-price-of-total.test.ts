import { describe, expect, it } from "vitest";

import { unitPriceOfTotal } from "@/features/transactions/trade-entry/unit-price-of-total";

describe("unitPriceOfTotal", () => {
  const cases: [string, number, number, number, number, string | null][] = [
    // 4504.00 ÷ 15 = 300.2666...; the 13th digit is 6, so the 12th rounds up.
    ["a repeating fraction", 450400, 2, 15, 0, "300.266666666667"],
    // 3000.00 ÷ 100 = 30 exactly; trailing zeros and the dot are removed.
    ["a whole price", 300000, 2, 100, 0, "30"],
    // 1.00 ÷ 3 = 0.3333...; the 13th digit is 3, so the 12th stays.
    ["a third rounded down", 100, 2, 3, 0, "0.333333333333"],
    // 2.00 ÷ 3 = 0.6666...; the 13th digit is 6, so the 12th rounds up.
    ["two thirds rounded up", 200, 2, 3, 0, "0.666666666667"],
    // 0.05 ÷ 2 = 0.025.
    ["a short fraction", 5, 2, 2, 0, "0.025"],
    // 0.01 ÷ 8 = 0.00125.
    ["a price below one cent", 1, 2, 8, 0, "0.00125"],
    // 1000.00 ÷ 1.5 units (150000000 at scale 8) = 666.6666...
    ["a quantity with scale", 100000, 2, 150000000, 8, "666.666666666667"],
    // total 0 has no price.
    ["a zero total", 0, 2, 1, 0, null],
    // quantity 0 has no price.
    ["a zero quantity", 100, 2, 0, 0, null],
    // 0.03 ÷ 2·10¹⁰ = 1.5·10⁻¹²: a tie, 1 is odd, so it rounds up to 2·10⁻¹².
    ["a tie to the even digit above", 3, 2, 20000000000, 0, "0.000000000002"],
    // 0.01 ÷ 2·10¹⁰ = 5·10⁻¹³ rounds to 0; a price of 0 is no price.
    ["a price rounded to zero", 1, 2, 20000000000, 0, null],
  ];

  it.each(cases)(
    "%s",
    (_name, total, totalScale, quantity, quantityScale, expected) => {
      expect(unitPriceOfTotal(total, totalScale, quantity, quantityScale)).toBe(
        expected,
      );
    },
  );
});
