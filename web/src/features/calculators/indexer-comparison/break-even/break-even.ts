import type {
  IndexData,
  Security,
} from "@/features/calculators/indexer-comparison/security";
import { rateAtIndex } from "@/features/calculators/indexer-comparison/security-rate";
import { bisect } from "@/features/calculators/model/solve";

const daysPerYear = 365;

// IC4; null without a root in [-0.5, 5], for a fixed security, or for the reference's own index.
export function breakEven(input: {
  security: Security;
  data: IndexData;
  reference: Security;
  referenceRate: number;
  days: number;
  taxBp: number;
}): number | null {
  const { security, data, reference, referenceRate, days, taxBp } = input;
  if (security.form === "fixed") return null;
  if (reference.index !== undefined && reference.index === security.index)
    return null;
  if (rateAtIndex(security, data, 0) === null) return null;

  const target = net(referenceRate, days, reference.taxed ? taxBp : 0);
  const securityTaxBp = security.taxed ? taxBp : 0;

  return bisect(
    (x) =>
      net(rateAtIndex(security, data, x) ?? Number.NaN, days, securityTaxBp),
    -0.5,
    5,
    target,
  );
}

// The unrounded net yield per unit of amount: the amount cancels in the comparison.
function net(rate: number, days: number, taxBp: number): number {
  return ((1 + rate) ** (days / daysPerYear) - 1) * (1 - taxBp / 10000);
}
