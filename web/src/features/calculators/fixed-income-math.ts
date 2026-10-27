import { roundHalfEven } from "@/features/calculators/round";

const daysPerYear = 365;

// Design §5, fixed-income: yield = amount × ((1 + r)^(days/365) − 1), the tax a share of the
// yield, and the annual rate of what remains. Amounts are minor units.
export function fixedIncome(input: {
  amount: number;
  annualRate: number;
  days: number;
  taxBp: number;
}): { gross: number; tax: number; net: number; netAnnualRate: number } {
  const { amount, annualRate, days, taxBp } = input;
  const gross = roundHalfEven(
    amount * ((1 + annualRate) ** (days / daysPerYear) - 1),
  );
  const tax = roundHalfEven((gross * taxBp) / 10000);
  const net = gross - tax;
  return {
    gross,
    tax,
    net,
    netAnnualRate: (1 + net / amount) ** (daysPerYear / days) - 1,
  };
}

// The taxable rate whose yield after tax t matches an exempt rate: r_t = r_e / (1 − t).
export function equivalentTaxable(exemptRate: number, taxBp: number): number {
  return exemptRate / (1 - taxBp / 10000);
}

// The exempt rate that matches a taxable rate after tax t: r_e = r_t × (1 − t).
export function equivalentExempt(taxableRate: number, taxBp: number): number {
  return taxableRate * (1 - taxBp / 10000);
}
