import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { indexesQuery, indexRatesQuery } from "@/features/calculators/api";
import type { Floating } from "@/features/calculators/floating";
import { dailySpread } from "@/features/calculators/index-catalog";
import {
  percentOfDaily,
  spreadOverDaily,
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

// The trailing 12 months of an index (design §4): of a daily index at a percent of each day's
// rate or plus a spread, of a monthly index over its last 12 months. Null while the rates load,
// when they cover less than a year, or when the percent or the spread is not a number.
export function useTrailingRate(
  index: Index | undefined,
  floating: Pick<Floating, "form" | "value"> = { form: "percent", value: 1 },
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
  if (index.period !== "day") {
    const rate = trailingMonthly(rates);
    return rate === null ? null : { rate, to: index.last };
  }
  if (floating.value === null) return null;
  const rate =
    floating.form === "percent"
      ? percentOfDaily(rates, floating.value)
      : spreadOverDaily(rates, floating.value, dailySpread(index.id));
  return rate === null ? null : { rate, to: index.last };
}
