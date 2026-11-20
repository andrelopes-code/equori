import type { HoldingsData } from "@/features/assistant/view/forms/portfolio/portfolio-data";

export type HoldingsKey = "value" | "result" | "weight";

// The rows ordered by one column, largest first.
export function sortHoldings(
  rows: HoldingsData["rows"],
  key: HoldingsKey,
): HoldingsData["rows"] {
  const by: Record<HoldingsKey, (r: HoldingsData["rows"][number]) => number> = {
    value: (r) => r.value.amount,
    result: (r) => r.result_bp,
    weight: (r) => r.weight_bp,
  };
  const pick = by[key];

  return [...rows].sort((a, b) => pick(b) - pick(a));
}
