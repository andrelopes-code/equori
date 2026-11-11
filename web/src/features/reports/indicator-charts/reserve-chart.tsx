import type { ChartSeries } from "@slotted/core/chart";
import { Chart } from "@slotted/react/chart";

import type { Indicators } from "@/features/overview";
import {
  indicatorChartRows,
  type IndicatorChartRow,
} from "@/features/reports/indicator-charts/indicator-chart-rows";
import { useIndicatorFormat } from "@/features/reports/model/use-indicator-format";
import { formatReferenceMonth } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

export interface ReserveChartProps {
  report: Indicators;
  incomplete: boolean;
}

// The third question: how much stands in liquid accounts against what is owed. Both are amounts of
// the report currency, so they share one axis that starts at zero; the legend writes each last value.
// Debts are an area too: a thin line over the large liquid area, a fraction of its height, was lost.
export function ReserveChart({ report, incomplete }: ReserveChartProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const format = useIndicatorFormat(report.currency);

  if (format === null) return null;

  const data = indicatorChartRows(report, incomplete, (month) =>
    formatReferenceMonth(month, locale),
  );
  const series: ChartSeries<keyof IndicatorChartRow>[] = [
    {
      id: "liquid",
      kind: "area",
      field: "liquid",
      label: t("report.indicators.reserve.liquid"),
      format: format.money,
      markers: "last",
    },
    {
      id: "debts",
      kind: "area",
      field: "debts",
      label: t("report.indicators.reserve.debts"),
      format: format.money,
      markers: "last",
    },
  ];

  return (
    <Chart
      variant="card"
      size="sm"
      title={t("report.indicators.reserve.title")}
      description={t("report.indicators.reserve.description")}
      data={data}
      series={series}
      x={{ field: "label" }}
      y={{ format: format.wholeMoney, extent: "zero" }}
      legendValues
    />
  );
}
