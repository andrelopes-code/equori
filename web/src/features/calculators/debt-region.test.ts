import { describe, expect, it } from "vitest";

import {
  debtRateQuote,
  monthlyDebtRate,
} from "@/features/calculators/debt-region";

describe("debtRateQuote", () => {
  it("quotes an APR in the United States and a monthly rate elsewhere", () => {
    expect(debtRateQuote("US")).toEqual({ period: "year", nominal: true });
    expect(debtRateQuote("BR")).toEqual({ period: "month", nominal: false });
  });
});

describe("monthlyDebtRate", () => {
  it.each([
    [0.03, "month", false, 0.03],
    [0.12, "year", true, 0.01],
    [0.1268250301, "year", false, 0.01],
  ] as const)(
    "reads %s a %s (nominal %s) as %s a month",
    (rate, period, nominal, want) => {
      expect(monthlyDebtRate(rate, period, nominal)).toBeCloseTo(want, 9);
    },
  );
});
