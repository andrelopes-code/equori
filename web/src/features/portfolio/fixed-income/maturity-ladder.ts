import type { components } from "@/api/schema.gen";
import {
  returnKind,
  type ContractTerms,
  type ReturnKind,
  type ValuedHolding,
} from "@/features/portfolio/fixed-income/return-kind";

type IndexSummary = Pick<components["schemas"]["Index"], "id" | "period">;

export interface LadderYear {
  year: number;
  value: number;
  // Percent of the largest year, two decimals.
  width: number;
  // The kind of the year's most valuable contract.
  kind: ReturnKind;
}

// The value by year of maturity; a holding without terms has no maturity and stays out.
export function maturityLadder(
  holdings: readonly ValuedHolding[],
  terms: ReadonlyMap<string, ContractTerms>,
  indexes: readonly IndexSummary[],
): LadderYear[] {
  const years = new Map<
    number,
    { value: number; top: number; kind: ReturnKind }
  >();
  for (const h of holdings) {
    const t = terms.get(h.code);
    if (t === undefined) continue;

    const year = Number(t.matures_on.slice(0, 4));
    const row = years.get(year) ?? {
      value: 0,
      top: -1,
      kind: "none" as ReturnKind,
    };
    row.value += h.value;
    if (h.value > row.top) {
      row.top = h.value;
      row.kind = returnKind(t, indexes);
    }

    years.set(year, row);
  }

  const max = Math.max(0, ...[...years.values()].map((r) => r.value));

  return [...years.entries()]
    .sort(([a], [b]) => a - b)
    .map(([year, r]) => ({
      year,
      value: r.value,
      width: max === 0 ? 0 : Math.round((r.value * 10000) / max) / 100,
      kind: r.kind,
    }));
}
