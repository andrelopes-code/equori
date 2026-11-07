import { describe, expect, it } from "vitest";

import { averageCostAmount } from "@/features/accounts/position-figures";

describe("averageCostAmount", () => {
  it.each([
    ["keeps every decimal of the text", "1076.0769", 2, 10760769, 4],
    ["drops the zeros past the currency's decimals", "3.0000", 2, 300, 2],
    ["keeps the decimals that matter after a zero", "12.3400", 2, 1234, 2],
    ["pads a text shorter than the currency", "411.5", 2, 41150, 2],
    ["pads a whole number", "40", 2, 4000, 2],
    ["reads a currency without decimals", "411.00", 0, 411, 0],
    ["keeps a small crypto price", "0.00012300", 2, 123, 6],
  ])("%s", (_name, text, currencyScale, amount, scale) => {
    expect(averageCostAmount(text, currencyScale)).toEqual({ amount, scale });
  });
});
