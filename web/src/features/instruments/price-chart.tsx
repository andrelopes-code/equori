import type { ChartSeries } from "@slotted/core/chart";
import { Chart } from "@slotted/react/chart";
import { useMemo } from "react";

import type { components } from "@/api/schema.gen";
import { formatDayMonth } from "@/i18n/format";
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
        .map((p) => ({
          label: formatDayMonth(p.date, locale),
          price: Number(p.value),
        })),
    [prices, locale],
  );
  const format = (value: number) =>
    fmt.hidden
      ? MASK
      : new Intl.NumberFormat(locale, { maximumFractionDigits: 6 }).format(
          value,
        );
  const series: ChartSeries[] = [
    {
      id: "price",
      kind: "line",
      field: "price",
      label: t("instrument.chart.title"),
      format,
    },
  ];
  return (
    <Chart
      variant="card"
      size="sm"
      loading={loading}
      title={t("instrument.chart.title")}
      data={data}
      series={series}
      x={{ field: "label" }}
      y={{ format }}
    />
  );
}
