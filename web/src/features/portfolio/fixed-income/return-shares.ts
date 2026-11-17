import type { components } from "@/api/schema.gen";
import {
  returnKind,
  type ContractTerms,
  type ReturnKind,
  type ValuedHolding,
} from "@/features/portfolio/fixed-income/return-kind";

type IndexSummary = Pick<components["schemas"]["Index"], "id" | "period">;

export interface ReturnShare {
  kind: ReturnKind;
  value: number;
  share: number;
}

const order: readonly ReturnKind[] = ["rate", "inflation", "fixed", "none"];

// The value by kind of return in whole percents, half to even; the largest kind takes the
// rounding so the shares sum to 100.
export function returnShares(
  holdings: readonly ValuedHolding[],
  terms: ReadonlyMap<string, ContractTerms>,
  indexes: readonly IndexSummary[],
): ReturnShare[] {
  const totals = new Map<ReturnKind, number>();
  for (const h of holdings) {
    const kind = returnKind(terms.get(h.code), indexes);
    totals.set(kind, (totals.get(kind) ?? 0) + h.value);
  }

  const total = holdings.reduce((sum, h) => sum + h.value, 0);
  const shares = order
    .filter((kind) => (totals.get(kind) ?? 0) > 0)
    .map((kind) => {
      const value = totals.get(kind) ?? 0;

      return { kind, value, share: halfEven((value * 100) / total) };
    });

  const largest = shares.reduce<ReturnShare | undefined>(
    (best, s) => (best === undefined || s.value > best.value ? s : best),
    undefined,
  );
  if (largest !== undefined)
    largest.share += 100 - shares.reduce((sum, s) => sum + s.share, 0);

  return shares;
}

function halfEven(x: number): number {
  const floor = Math.floor(x);
  const rest = x - floor;
  if (Math.abs(rest - 0.5) < 1e-9) return floor % 2 === 0 ? floor : floor + 1;

  return Math.round(x);
}
