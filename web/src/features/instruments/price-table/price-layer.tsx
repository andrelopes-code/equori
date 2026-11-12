import { Stack } from "@slotted/react/stack";
import { useState } from "react";

import type { components } from "@/api/schema.gen";
import { sourceLabel } from "@/features/instruments/model/instrument-labels";
import { sourcesOf } from "@/features/instruments/model/price-filter";
import type { PriceStats } from "@/features/instruments/model/price-stats";
import { usePriceFormat } from "@/features/instruments/model/use-price-format";
import { PriceTable } from "@/features/instruments/price-table/price-table";
import { formatDate, numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import styles from "@/ui/dialogs/detail-dialog.module.css";
import { FigureCard } from "@/ui/display/figure-card";
import { ChoiceSelect } from "@/ui/form-fields/choice-select";

type Price = components["schemas"]["Price"];

// The value of the filter choice that keeps every source; a source id never holds "*".
const ALL_SOURCES = "*";

interface PriceLayerProps {
  prices: readonly Price[];
  stats: PriceStats;
}

// The body of the prices layer (L1): the figures of the series, the source filter and the table.
export function PriceLayer({ prices, stats }: PriceLayerProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const format = usePriceFormat(stats.last.quote_instrument);

  const [source, setSource] = useState(ALL_SOURCES);

  const choices = [
    { value: ALL_SOURCES, label: t("instrument.prices.filter.all") },
    ...sourcesOf(prices).map((id) => ({
      value: id,
      label: sourceLabel(t, id),
    })),
  ];

  function handleSourceChange(next: string | string[] | null) {
    if (typeof next === "string") setSource(next);
  }

  return (
    <Stack gap={4}>
      <div className={styles.strip}>
        <FigureCard
          label={t("instrument.prices.points")}
          value={numberFormatter(locale).format(stats.count)}
          note=""
        />
        <FigureCard
          label={t("instrument.prices.first")}
          value={formatDate(stats.first.date, locale)}
          note={format.text(stats.first.value)}
        />
        <FigureCard
          label={t("instrument.prices.last")}
          value={formatDate(stats.last.date, locale)}
          note={format.text(stats.last.value)}
        />
        <FigureCard
          label={t("instrument.prices.high")}
          value={format.text(stats.high.value)}
          note={formatDate(stats.high.date, locale)}
        />
        <FigureCard
          label={t("instrument.prices.low")}
          value={format.text(stats.low.value)}
          note={formatDate(stats.low.date, locale)}
        />
      </div>

      <div className={styles.main}>
        <Stack gap={3}>
          <ChoiceSelect
            label={t("instrument.prices.filter")}
            choices={choices}
            multiple={false}
            value={source}
            onChange={handleSourceChange}
          />

          <PriceTable
            prices={prices}
            loading={false}
            source={source === ALL_SOURCES ? null : source}
          />
        </Stack>
      </div>
    </Stack>
  );
}
