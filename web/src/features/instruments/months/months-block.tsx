import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { priceSeriesQuery } from "@/features/instruments/api";
import { adjustedPrices } from "@/features/instruments/model/adjusted-prices";
import { rangeWindow } from "@/features/instruments/model/price-window";
import { monthChanges } from "@/features/instruments/months/month-changes";
import { MonthFacts } from "@/features/instruments/months/month-facts";
import { monthSeries } from "@/features/instruments/months/month-series";
import { MonthsPending } from "@/features/instruments/months/months-pending";
import { MonthsSection } from "@/features/instruments/months/months-section";
import { MonthsTable } from "@/features/instruments/months/months-table";
import { useToday } from "@/i18n/today";
import { QueryError } from "@/ui/feedback/query-error";
import { monthFigures } from "@/ui/month-heat/month-figures";

interface MonthsBlockProps {
  code: string;
  quote: string;
  // The date of the first quote; null when the instrument has none.
  first: string | null;
}

// IM1 to IM10: the price change of each month, read from the series of the range max.
export function MonthsBlock({ code, quote, first }: MonthsBlockProps) {
  const api = useApi();
  const today = useToday();
  const { from, to } = rangeWindow(today, "max", first);
  const series = useQuery(priceSeriesQuery(api, code, quote, from, to));

  if (series.isError)
    return (
      <MonthsSection>
        <QueryError
          error={series.error}
          onRetry={() => void series.refetch()}
        />
      </MonthsSection>
    );

  if (series.isPending) return first === null ? null : <MonthsPending />;

  const rows = monthChanges(adjustedPrices(series.data.items));
  const figures = monthFigures(monthSeries(rows));
  if (figures === null) return null;

  return (
    <MonthsSection>
      <MonthFacts figures={figures} />

      <MonthsTable rows={rows} quote={quote} />
    </MonthsSection>
  );
}
