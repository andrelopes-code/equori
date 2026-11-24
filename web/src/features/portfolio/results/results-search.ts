import { validatePortfolioSearch } from "@/features/portfolio/model/portfolio-search";

export type ResultsPeriod = "1m" | "3m" | "6m" | "ytd" | "12m" | "2y" | "5y";

export const resultsPeriods: readonly ResultsPeriod[] = [
  "1m",
  "3m",
  "6m",
  "ytd",
  "12m",
  "2y",
  "5y",
];

// Every key is absent while it holds its default.
export interface ResultsSearch {
  // The valuation currency; the base currency when absent.
  value_in?: string;
  // The brokerage tree; every brokerage when absent.
  account?: string;
  // A preset; the whole history when absent and no range is set.
  period?: ResultsPeriod;
  // YYYY-MM-DD: a custom range; both or neither.
  from?: string;
  to?: string;
}

export function validateResultsSearch(
  raw: Record<string, unknown>,
): ResultsSearch {
  const { value_in, account, from, to } = validatePortfolioSearch(raw);
  const range = from !== undefined && to !== undefined ? { from, to } : {};
  const period = resultsPeriods.find((p) => p === raw.period);

  return {
    ...(value_in === undefined ? {} : { value_in }),
    ...(account === undefined ? {} : { account }),
    ...(period === undefined || "from" in range ? {} : { period }),
    ...range,
  };
}
