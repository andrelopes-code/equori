import type { components } from "@/api/schema.gen";

type OpeningLoss = components["schemas"]["OpeningLoss"];

export interface LossRow {
  pool: string;
  // YYYY-MM.
  month: string;
  // Minor units; zero is an empty row.
  amount: number;
}

// One row per pool in the order of the answer; a pool without a saved loss starts empty at
// `fallbackMonth`. The edits override the saved values pool by pool.
export function lossRows(
  pools: string[],
  losses: OpeningLoss[],
  fallbackMonth: string,
  edits: Record<string, Partial<LossRow>>,
): LossRow[] {
  return pools.map((pool) => {
    const saved = losses.find((l) => l.pool === pool);

    return {
      pool,
      month: saved?.month ?? fallbackMonth,
      amount: saved?.amount.amount ?? 0,
      ...edits[pool],
    };
  });
}

// The body of the put: rows left empty are not sent.
export function rowsToLosses(rows: LossRow[], currency: string): OpeningLoss[] {
  return rows
    .filter((r) => r.amount > 0)
    .map((r) => ({
      pool: r.pool,
      month: r.month,
      amount: { amount: r.amount, currency },
    }));
}
