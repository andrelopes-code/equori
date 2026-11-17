import type { components } from "@/api/schema.gen";

type IndexSummary = Pick<components["schemas"]["Index"], "id" | "period">;

export type ReturnKind = "rate" | "inflation" | "fixed" | "none";

export interface ContractTerms {
  index_id?: string;
  matures_on: string;
}

export interface ValuedHolding {
  code: string;
  value: number;
}

// The kind of return of a contract from the period of its index (A236 FC9): a daily index pays a
// rate, a monthly one updates principal by inflation, no index is a fixed rate.
export function returnKind(
  terms: ContractTerms | undefined,
  indexes: readonly IndexSummary[],
): ReturnKind {
  if (terms === undefined) return "none";
  if (terms.index_id === undefined) return "fixed";

  const period = indexes.find((i) => i.id === terms.index_id)?.period;

  return period === "month" ? "inflation" : "rate";
}
