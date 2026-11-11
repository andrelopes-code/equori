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

export interface RateChartProps {
  report: Indicators;
  incomplete: boolean;
}

// The savings rate of each month against its 12-month mean, on an axis that holds zero. It is its
// own chart: a percentage never shares an axis with an amount.
export function RateChart({ report, incomplete }: RateChartProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const format = useIndicatorFormat(report.currency);

  if (format === null) return null;

  const data = indicatorChartRows(report, incomplete, (month) =>
    formatReferenceMonth(month, locale),
  );
  const series: ChartSeries<keyof IndicatorChartRow>[] = [
    {
      id: "savings",
      kind: "line",
      field: "savings",
      label: t("report.indicators.savings"),
      format: format.percent,
      markers: "last",
    },
    {
      id: "trailing",
      kind: "line",
      field: "trailing",
      label: t("report.indicators.trailing"),
      format: format.percent,
      stroke: "dashed",
    },
  ];

  return (
    <Chart
      variant="card"
      size="sm"
      title={t("report.indicators.rate.title")}
      description={t("report.indicators.rate.description")}
      data={data}
      series={series}
      x={{ field: "label" }}
      y={{ format: format.percent, extent: "zero" }}
    />
  );
}
