import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { curvesQuery } from "@/features/calculators";
import { fundReportsQuery, latestPriceQuery } from "@/features/instruments/api";
import {
  breakEvenGrowth,
  referenceRate,
} from "@/features/instruments/fund-report/break-even";
import { fundFigures } from "@/features/instruments/fund-report/fund-figures";
import { useToday } from "@/i18n/today";

// The report of an instrument with its figures against the latest price in the quote currency.
// A price in a currency other than the report's is not used.
export function useFundReport(code: string, quote: string | null) {
  const api = useApi();
  const today = useToday();
  const report = useQuery(fundReportsQuery(api, code)).data?.[0];
  const latest = useQuery({
    ...latestPriceQuery(api, code, quote ?? "", today),
    enabled: quote !== null,
  }).data;
  const curves = useQuery(curvesQuery(api)).data ?? [];

  const otherCurrency =
    report !== undefined && quote !== null && quote !== report.currency;
  const price =
    latest === undefined || latest === null || otherCurrency
      ? null
      : Number(latest.value);
  const figures = report === undefined ? null : fundFigures(report, price);
  const reference =
    report === undefined ? null : referenceRate(curves, report.currency);
  const growth =
    figures?.yearYield == null || reference === null
      ? null
      : breakEvenGrowth(figures.yearYield, reference.rate);
  const priceDate = price === null ? null : (latest?.date ?? null);

  return { report, figures, reference, growth, priceDate, otherCurrency };
}
