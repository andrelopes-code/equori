import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import {
  indexesQuery,
  indexExpectationsQuery,
  indexRatesQuery,
} from "@/features/calculators/api";
import type { Floating } from "@/features/calculators/floating";
import { dailySpread } from "@/features/calculators/index-catalog";
import {
  expectedOverDaily,
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

// The annual rate of an index (design §4): of a daily index at a percent of each day's rate or
// plus a spread, on its current or trailing basis; of a monthly index over its last 12 months.
// Null while the rates load, when they cover less than a year, or when the percent or the spread
// is not a number.
export function useIndexRate(
  index: Index | undefined,
  floating: Pick<Floating, "form" | "value" | "basis"> = {
    form: "percent",
    value: 1,
    basis: "current",
  },
  // The calculator's horizon in months, for the expected basis (ADR 026 E8).
  months = 12,
): { rate: number; to: string } | null {
  const api = useApi();
  const expected = floating.basis === "expected" && index?.expected === true;
  const survey = useQuery({
    ...indexExpectationsQuery(api, index?.id ?? ""),
    enabled: expected,
  }).data;
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
  const value = floating.value;
  if (value === null) return null;
  if (expected) {
    if (survey === undefined) return null;
    const spreadDaily = dailySpread(index.id);
    // As spreadOverDaily: a 360th of the spread on each day of an actual/360 index, otherwise
    // the spread compounded over the n stored days of a year.
    const rate = expectedOverDaily(rates, survey.points, months, (d, n) =>
      floating.form === "percent"
        ? 1 + value * d
        : spreadDaily
          ? 1 + d + value / 360
          : (1 + d) * (1 + value) ** (1 / n),
    );
    return rate === null ? null : { rate, to: survey.surveyDate };
  }
  const basis = floating.basis === "trailing" ? "trailing" : "current";
  const rate =
    floating.form === "percent"
      ? percentOfDaily(rates, value, basis)
      : spreadOverDaily(rates, value, dailySpread(index.id), basis);
  return rate === null ? null : { rate, to: index.last };
}
