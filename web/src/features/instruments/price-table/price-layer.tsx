import { Inline } from "@slotted/react/inline";
import { Stack } from "@slotted/react/stack";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import { priceSeriesQuery } from "@/features/instruments/api";
import { sourceLabel } from "@/features/instruments/model/instrument-labels";
import { sourcesOf } from "@/features/instruments/model/price-filter";
import { priceStats } from "@/features/instruments/model/price-stats";
import { PriceFigures } from "@/features/instruments/price-table/price-figures";
import { PriceTable } from "@/features/instruments/price-table/price-table";
import { priceYears } from "@/features/instruments/price-table/price-years";
import { useT } from "@/i18n/i18n-provider";
import styles from "@/ui/dialogs/detail-dialog.module.css";
import { QueryError } from "@/ui/feedback/query-error";
import { ChoiceSelect } from "@/ui/form-fields/choice-select";

// The value of the filter choice that keeps every source; a source id never holds "*".
const ALL_SOURCES = "*";

interface PriceLayerProps {
  code: string;
  quote: string;
  first: string;
  last: string;
}

// The body of the prices layer (L1, IM11): the figures of one year, its filters and its table. The
// prices are the traded closes (A266 SA6).
export function PriceLayer({ code, quote, first, last }: PriceLayerProps) {
  const t = useT();
  const api = useApi();

  const [year, setYear] = useState(last.slice(0, 4));
  const [source, setSource] = useState(ALL_SOURCES);

  const series = useQuery(
    priceSeriesQuery(api, code, quote, `${year}-01-01`, `${year}-12-31`),
  );

  const prices = series.data?.items ?? [];
  const years = priceYears(first, last).map((y) => ({
    value: String(y),
    label: String(y),
  }));
  const sources = [
    { value: ALL_SOURCES, label: t("instrument.prices.filter.all") },
    ...sourcesOf(prices).map((id) => ({
      value: id,
      label: sourceLabel(t, id),
    })),
  ];

  // Another year can lack the source the filter holds.
  function handleYearChange(next: string | string[] | null) {
    if (typeof next !== "string") return;

    setYear(next);
    setSource(ALL_SOURCES);
  }

  function handleSourceChange(next: string | string[] | null) {
    if (typeof next === "string") setSource(next);
  }

  return (
    <Stack gap={4}>
      <PriceFigures
        stats={priceStats(prices)}
        quote={quote}
        loading={series.isPending}
      />

      <div className={styles.main}>
        <Stack gap={3}>
          <Inline gap={3}>
            <ChoiceSelect
              label={t("instrument.prices.year")}
              choices={years}
              multiple={false}
              value={year}
              onChange={handleYearChange}
            />

            <ChoiceSelect
              label={t("instrument.prices.filter")}
              choices={sources}
              multiple={false}
              value={source}
              onChange={handleSourceChange}
            />
          </Inline>

          {series.isError && (
            <QueryError
              error={series.error}
              onRetry={() => void series.refetch()}
            />
          )}

          {!series.isError && (
            <PriceTable
              prices={prices}
              loading={series.isPending}
              source={source === ALL_SOURCES ? null : source}
            />
          )}
        </Stack>
      </div>
    </Stack>
  );
}
