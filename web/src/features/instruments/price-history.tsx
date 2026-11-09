import {
  Collapsible,
  CollapsibleHeader,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@slotted/react/collapsible";
import { Segment, SegmentedControl } from "@slotted/react/segmented-control";
import { Stack } from "@slotted/react/stack";
import { useQuery } from "@tanstack/react-query";
import { useDeferredValue, useState } from "react";

import { useApi } from "@/api/api-context";
import { pricesQuery } from "@/features/instruments/api";
import { PriceChart } from "@/features/instruments/price-chart";
import { PriceTable } from "@/features/instruments/price-table";
import {
  type PriceRange,
  priceRanges,
  rangeWindow,
} from "@/features/instruments/price-window";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { QueryError } from "@/ui/query-error";

interface PriceHistoryProps {
  instrument: string;
  quote: string;
  first: string | null;
}

// The prices of one instrument over a range of at most 18,300 days, as a chart and a table.
// CP-09: the segment moves at once; the chart and the table render from the deferred range.
export function PriceHistory({ instrument, quote, first }: PriceHistoryProps) {
  const t = useT();
  const api = useApi();
  const today = useToday();
  const [range, setRange] = useState<PriceRange>("m3");
  const shown = useDeferredValue(range);
  const { from, to } = rangeWindow(today, shown, first);
  const prices = useQuery(pricesQuery(api, instrument, quote, from, to));
  return (
    <Stack gap={3} aria-busy={shown !== range || undefined}>
      <SegmentedControl
        size="sm"
        aria-label={t("instrument.range.label")}
        value={range}
        onValueChange={(value) => {
          const next = priceRanges.find((r) => r === value);
          if (next !== undefined) setRange(next);
        }}
      >
        {priceRanges.map((r) => (
          <Segment key={r} value={r}>
            {t(`instrument.range.${r}`)}
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
          {(prices.isPending || prices.data.length > 0) && (
            <PriceChart prices={prices.data ?? []} loading={prices.isPending} />
          )}
          {prices.data?.length === 0 && (
            <PriceTable prices={[]} loading={false} />
          )}

          {prices.data !== undefined && prices.data.length > 0 && (
            <Collapsible mount="lazy">
              <CollapsibleHeader>
                <CollapsibleTrigger>
                  {t("instrument.prices.caption")}
                </CollapsibleTrigger>
              </CollapsibleHeader>
              <CollapsiblePanel>
                <PriceTable prices={prices.data} loading={false} />
              </CollapsiblePanel>
            </Collapsible>
          )}
        </>
      )}
    </Stack>
  );
}
