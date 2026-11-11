import type { ChartSeries } from "@slotted/core/chart";
import { Chart } from "@slotted/react/chart";
import { useMemo } from "react";

import type { components } from "@/api/schema.gen";
import {
  axisLabel,
  axisSpanDays,
  showMarkers,
} from "@/features/instruments/price-axis";
import { numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { MASK } from "@/privacy/mask";
import { useMoneyFormat } from "@/privacy/use-money-format";

type Price = components["schemas"]["Price"];

// A price is an exact decimal that the chart plots as a number; nothing is computed from it.
export function PriceChart({
  prices,
  loading,
}: {
  prices: readonly Price[];
  loading: boolean;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const data = useMemo(
    () =>
      [...prices]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((p) => ({ date: p.date, price: Number(p.value) })),
    [prices],
  );
  const span = axisSpanDays(data);
  const format = (value: number) =>
    fmt.hidden
      ? MASK
      : numberFormatter(locale, { maximumFractionDigits: 6 }).format(value);
  const series: ChartSeries<"date" | "price">[] = [
    {
      id: "price",
      kind: "line",
      field: "price",
      label: t("instrument.chart.title"),
      format,
      // A time axis keeps the gaps between recorded prices; a marker shows each recorded price
      // until the line is too dense for it.
      markers: showMarkers(data.length) ? "all" : "last",
    },
  ];
  return (
    <Chart
      variant="card"
      size="sm"
      loading={loading}
      aria-label={t("instrument.prices.title")}
      legend={false}
      data={data}
      series={series}
      x={{
        field: "date",
        type: "time",
        format: (value) => axisLabel(value, locale, span),
      }}
      y={{ format }}
    />
  );
}
