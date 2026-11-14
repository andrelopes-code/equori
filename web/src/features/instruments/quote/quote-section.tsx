import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";
import { useQuery } from "@tanstack/react-query";
import { useDeferredValue, useState } from "react";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { priceSeriesQuery } from "@/features/instruments/api";
import { positionTotals } from "@/features/instruments/model/position-totals";
import { PriceChart } from "@/features/instruments/price-chart/price-chart";
import { PriceDetails } from "@/features/instruments/price-table/price-details";
import { PriceRangeControl } from "@/features/instruments/quote/price-range-control";
import { priceStats } from "@/features/instruments/model/price-stats";
import {
  type PriceRange,
  rangeWindow,
} from "@/features/instruments/model/price-window";
import { QuoteHero } from "@/features/instruments/quote/quote-hero";
import { quoteReading } from "@/features/instruments/quote/quote-reading";
import { RangeFigures } from "@/features/instruments/quote/range-figures";
import { YearlyChanges } from "@/features/instruments/quote/yearly-changes";
import { useInstrumentPositions } from "@/features/instruments/model/use-instrument-positions";
import {
  type Zoom,
  pricesInZoom,
  wholeRange,
} from "@/features/instruments/model/zoom-window";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { QueryError } from "@/ui/feedback/query-error";

import styles from "@/features/instruments/quote/quote-section.module.css";

type Instrument = components["schemas"]["Instrument"];

interface QuoteSectionProps {
  instrument: Instrument;
  quote: string;
}

// Q1. CP-09: the segment moves at once; the chart and the figures render from the deferred range.
export function QuoteSection({ instrument, quote }: QuoteSectionProps) {
  const t = useT();
  const api = useApi();
  const today = useToday();
  const [range, setRange] = useState<PriceRange>("m3");
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const [zoom, setZoom] = useState<Zoom>(wholeRange);
  const shown = useDeferredValue(range);
  const first = instrument.coverage?.first ?? null;
  const window = rangeWindow(today, shown, first);
  const recentWindow = rangeWindow(today, "y1", first);
  const series = useQuery(
    priceSeriesQuery(api, instrument.code, quote, window.from, window.to),
  );
  const recent = useQuery(
    priceSeriesQuery(
      api,
      instrument.code,
      quote,
      recentWindow.from,
      recentWindow.to,
    ),
  );
  const { rows } = useInstrumentPositions(instrument.code);

  const prices = series.data?.items ?? [];
  const reading = quoteReading(recent.data?.items ?? [], prices, activeDate);
  const stats = priceStats(pricesInZoom(prices, zoom));
  const averageCost = positionTotals(rows, quote)?.averageCost ?? null;

  // The chart of another range starts unzoomed (key={shown}); the selection starts with it.
  function handleRangeChange(next: PriceRange) {
    setRange(next);
    setZoom(wholeRange);
  }

  if (series.isError)
    return (
      <QueryError error={series.error} onRetry={() => void series.refetch()} />
    );

  return (
    <Stack gap={4} aria-busy={shown !== range || undefined}>
      <div className={styles.head}>
        <div className={styles.hero}>
          <QuoteHero
            reading={reading}
            quote={quote}
            loading={recent.isPending}
            stale={instrument.coverage?.stale ?? false}
          />
        </div>
        <PriceRangeControl value={range} onChange={handleRangeChange} />
      </div>
      {(series.isPending || prices.length > 0) && (
        <PriceChart
          key={shown}
          prices={prices}
          quote={quote}
          loading={series.isPending}
          averageCost={averageCost}
          onActiveDateChange={setActiveDate}
          onZoomChange={setZoom}
        />
      )}
      {series.data?.items.length === 0 && (
        <Text size="sm" tone="muted">
          {t("instrument.prices.empty")}
        </Text>
      )}
      {(series.isPending || stats !== null) && (
        <RangeFigures stats={stats} quote={quote} loading={series.isPending} />
      )}
      {prices.length > 0 && <PriceDetails prices={prices} />}
      <YearlyChanges code={instrument.code} quote={quote} first={first} />
    </Stack>
  );
}
