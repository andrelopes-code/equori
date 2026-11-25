import { outsideRange } from "@/features/portfolio/projection/model/outside-range";
import { parseBasisPoints } from "@/features/portfolio/projection/model/parse-percent";

// PJ7: the optional premises as typed; an empty field is a value the plan does not hold.
export interface PremiseFields {
  withdrawalReturn: string;
  cautious: string;
  favorable: string;
  gainTax: string;
}

// The premises as they validate, in basis points.
export interface Premises {
  withdrawalReturnBp?: number | undefined;
  cautiousReturnBp?: number | undefined;
  favorableReturnBp?: number | undefined;
  gainTaxBp?: number | undefined;
}

export type PremiseRanges = Partial<
  Record<keyof PremiseFields, [min: number, max: number]>
>;

// PJ7: null while a typed field is not a number or outside its range; the cautious return is below
// the plan's and the favorable above it.
export function premisesFrom(
  fields: PremiseFields,
  realReturnBp: number,
): Premises | null {
  if (Object.keys(premiseRanges(fields, realReturnBp)).length > 0) return null;

  const typed = {
    withdrawalReturnBp: parseBasisPoints(fields.withdrawalReturn),
    cautiousReturnBp: parseBasisPoints(fields.cautious),
    favorableReturnBp: parseBasisPoints(fields.favorable),
    gainTaxBp: parseBasisPoints(fields.gainTax),
  };

  return Object.fromEntries(
    Object.entries(typed).filter(([, bp]) => bp !== null),
  );
}

// The range each typed field left; without a real return the two cases have none.
export function premiseRanges(
  fields: PremiseFields,
  realReturnBp: number | null,
): PremiseRanges {
  const ranges: PremiseRanges = {};

  if (outsideBp(fields.withdrawalReturn, -1000, 3000))
    ranges.withdrawalReturn = [-10, 30];
  if (outsideBp(fields.gainTax, 1, 5000)) ranges.gainTax = [0.01, 50];
  if (realReturnBp === null) return ranges;

  if (outsideBp(fields.cautious, -1000, realReturnBp - 1))
    ranges.cautious = [-10, (realReturnBp - 1) / 100];
  if (outsideBp(fields.favorable, realReturnBp + 1, 3000))
    ranges.favorable = [(realReturnBp + 1) / 100, 30];

  return ranges;
}

function outsideBp(text: string, min: number, max: number): boolean {
  return outsideRange(text, parseBasisPoints(text), min, max);
}
