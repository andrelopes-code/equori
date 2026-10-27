import { depositsValue } from "@/features/calculators/compound-math";
import { annualToMonthly } from "@/features/calculators/rate-math";
import { roundHalfEven } from "@/features/calculators/round";

// Design §5, recurring-cost: what a payment repeated perYear times a year for years costs, and
// what the same payments would reach as deposits at the start of each period at the rate of
// that period (M2, M5). Amounts are minor units.
export function recurringCost(
  amount: number,
  perYear: 1 | 12,
  years: number,
  annualRate: number | null,
): { total: number; futureValue: number | null } {
  const n = perYear * years;
  const periodRate =
    annualRate === null
      ? null
      : perYear === 12
        ? annualToMonthly(annualRate)
        : annualRate;
  return {
    total: amount * n,
    futureValue:
      periodRate === null ? null : depositsValue(amount, periodRate, n),
  };
}

export type OwnershipComponent =
  | "forgone"
  | "propertyTax"
  | "deduction"
  | "maintenance"
  | "appreciation"
  | "riskPremium";

// Study §3.5 (Himmelberg, Mayer and Sinai 2005): annual cost of owning = P·r_rf + P·ω −
// P·τ(r_m + ω) + P·δ − P·g + P·γ, each component rounded to a minor unit.
export function ownershipCost(input: {
  price: number;
  riskFree: number;
  propertyTax: number;
  deductibleTax: number;
  mortgage: number;
  maintenance: number;
  appreciation: number;
  riskPremium: number;
}): { total: number; components: Record<OwnershipComponent, number> } {
  const p = input.price;
  const components: Record<OwnershipComponent, number> = {
    forgone: roundHalfEven(p * input.riskFree),
    propertyTax: roundHalfEven(p * input.propertyTax),
    deduction: roundHalfEven(
      -p * input.deductibleTax * (input.mortgage + input.propertyTax),
    ),
    maintenance: roundHalfEven(p * input.maintenance),
    appreciation: roundHalfEven(-p * input.appreciation),
    riskPremium: roundHalfEven(p * input.riskPremium),
  };
  return {
    total: Object.values(components).reduce((s, v) => s + v, 0),
    components,
  };
}
