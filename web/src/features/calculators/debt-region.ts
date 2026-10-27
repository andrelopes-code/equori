import { annualToMonthly } from "@/features/calculators/rate-math";
import type { RatePeriod } from "@/ui/rate-input";

// How a region quotes the rate of a card or a loan, for the debt payoff calculator. An
// extension point of ADR 016: docs/contributing/regions.md. A region without a case quotes a
// monthly rate, and reads an annual rate as effective.
export interface DebtRateQuote {
  period: RatePeriod;
  // An annual rate is nominal: the month's rate is the annual rate divided by 12.
  nominal: boolean;
}

export function debtRateQuote(region: string): DebtRateQuote {
  switch (region) {
    // Cards and loans state an APR, the periodic rate times the periods in a year
    // (Regulation Z: 12 CFR 1026.14(b) for cards, appendix J for loans).
    case "US":
      return { period: "year", nominal: true };
    default:
      return { period: "month", nominal: false };
  }
}

// The monthly rate of a rate typed in the given period.
export function monthlyDebtRate(
  rate: number,
  period: RatePeriod,
  nominal: boolean,
): number {
  if (period === "month") return rate;
  return nominal ? rate / 12 : annualToMonthly(rate);
}
