import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { indexesQuery, indexRatesQuery } from "@/features/calculators/api";
import {
  percentOfDaily,
  trailingMonthly,
} from "@/features/calculators/index-rates";

export type Index = components["schemas"]["Index"];

// The indexes the instance stores; none while they load or when the read fails, so a
// calculator offers fixed rates only (design §4, "Index data").
export function useIndexes(): Index[] {
  return useQuery(indexesQuery(useApi())).data ?? [];
}

// 13 months before a date: room for the trailing year and the days before its start.
function windowStart(last: string): string {
  const d = new Date(`${last}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - 13);
  return d.toISOString().slice(0, 10);
}

// The trailing 12 months of an index (design §4): of a daily index at multiplier of each day's
// rate, of a monthly index over its last 12 months. Null while the rates load or when they
// cover less than a year.
export function useTrailingRate(
  index: Index | undefined,
  multiplier = 1,
): { rate: number; to: string } | null {
  const api = useApi();
  const rates = useQuery({
    ...indexRatesQuery(
      api,
      index?.id ?? "",
      index === undefined ? "" : windowStart(index.last),
      index?.last ?? "",
    ),
    enabled: index !== undefined,
  }).data;
  if (index === undefined || rates === undefined) return null;
  const rate =
    index.period === "day"
      ? percentOfDaily(rates, multiplier)
      : trailingMonthly(rates);
  return rate === null ? null : { rate, to: index.last };
}
