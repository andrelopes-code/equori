import { roundHalfEven } from "@/features/calculators/model/round";

const daysPerYear = 365;

// Design §5, fixed-income: yield = amount × ((1 + r)^(days/365) − 1), the redemption tax a
// share of the yield, the tax a share of what it leaves (spec 2026-11-19 RT2), and the annual
// rate of what remains. Amounts are minor units.
export function fixedIncome(input: {
  amount: number;
  annualRate: number;
  days: number;
  taxBp: number;
  redemptionBp?: number;
}): {
  gross: number;
  redemption: number;
  tax: number;
  net: number;
  netAnnualRate: number;
} {
  const { amount, annualRate, days, taxBp, redemptionBp = 0 } = input;
  const gross = roundHalfEven(
    amount * ((1 + annualRate) ** (days / daysPerYear) - 1),
  );
  const redemption = roundHalfEven((gross * redemptionBp) / 10000);
  const tax = roundHalfEven(((gross - redemption) * taxBp) / 10000);
  const net = gross - redemption - tax;

  return {
    gross,
    redemption,
    tax,
    net,
    netAnnualRate: (1 + net / amount) ** (daysPerYear / days) - 1,
  };
}

// Spec 2026-11-19 RT4: the share of the yield both taxes take, the tax on what the redemption
// tax leaves.
export function combinedBp(taxBp: number, redemptionBp: number): number {
  return redemptionBp + taxBp * (1 - redemptionBp / 10000);
}

// The taxable rate whose yield after tax t matches an exempt rate: r_t = r_e / (1 − t).
export function equivalentTaxable(exemptRate: number, taxBp: number): number {
  return exemptRate / (1 - taxBp / 10000);
}

// The exempt rate that matches a taxable rate after tax t: r_e = r_t × (1 − t).
export function equivalentExempt(taxableRate: number, taxBp: number): number {
  return taxableRate * (1 - taxBp / 10000);
}
