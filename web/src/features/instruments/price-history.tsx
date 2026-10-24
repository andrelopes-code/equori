import { Segment, SegmentedControl } from "@slotted/react/segmented-control";
import { Stack } from "@slotted/react/stack";
import { useQuery } from "@tanstack/react-query";
import { useDeferredValue, useState } from "react";

import { useApi } from "@/api/api-context";
import { pricesQuery } from "@/features/instruments/api";
import { PriceChart } from "@/features/instruments/price-chart";
import { PriceTable } from "@/features/instruments/price-table";
import { maxPriceDays, priceWindow } from "@/features/instruments/price-window";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { QueryError } from "@/ui/query-error";

const ranges = [30, 90, maxPriceDays] as const;

// The prices of one instrument over a range of at most 366 days, as a chart and a table.
// CP-09: the segment moves at once; the chart and the table render from the deferred range.
export function PriceHistory({
  instrument,
  quote,
}: {
  instrument: string;
  quote: string;
}) {
  const t = useT();
  const api = useApi();
  const today = useToday();
  const [range, setRange] = useState<number>(90);
  const shown = useDeferredValue(range);
  const { from, to } = priceWindow(today, shown);
  const prices = useQuery(pricesQuery(api, instrument, quote, from, to));
  return (
    <Stack gap={3} aria-busy={shown !== range || undefined}>
      <SegmentedControl
        size="sm"
        aria-label={t("instrument.range.label")}
        value={String(range)}
        onValueChange={(value) => {
          const next = Number(value);
          if ((ranges as readonly number[]).includes(next)) setRange(next);
        }}
      >
        {ranges.map((days) => (
          <Segment key={days} value={String(days)}>
            {t("instrument.range.days", { count: days })}
          </Segment>
        ))}
      </SegmentedControl>
      {prices.isError ? (
        <QueryError
          error={prices.error}
          onRetry={() => void prices.refetch()}
        />
      ) : (
        <>
          <PriceChart prices={prices.data ?? []} loading={prices.isPending} />
          <PriceTable prices={prices.data ?? []} loading={prices.isPending} />
        </>
      )}
    </Stack>
  );
}
