import type { ChartAnnotation, ChartSeries } from "@slotted/core/chart";
import { Chart } from "@slotted/react/chart";

import type { Indicators } from "@/features/overview";
import {
  indicatorChartRows,
  type IndicatorChartRow,
} from "@/features/reports/indicator-chart-rows";
import { useIndicatorFormat } from "@/features/reports/use-indicator-format";
import { formatReferenceMonth } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

export interface FlowsChartProps {
  report: Indicators;
  incomplete: boolean;
}

// The last question: what came in and what went out each month. A texture tells the two series apart
// beside their color, and an incomplete last month is marked by a labelled line: a band was a pale
// block that clipped its label.
export function FlowsChart({ report, incomplete }: FlowsChartProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const format = useIndicatorFormat(report.currency);

  if (format === null) return null;

  const data = indicatorChartRows(report, incomplete, (month) =>
    formatReferenceMonth(month, locale),
  );
  const series: ChartSeries<keyof IndicatorChartRow>[] = [
    {
      id: "income",
      kind: "bar",
      field: "income",
      label: t("report.indicators.income"),
      format: format.money,
    },
    {
      id: "expense",
      kind: "bar",
      field: "expense",
      label: t("report.indicators.expense"),
      format: format.money,
    },
  ];
  const last = data.at(-1)?.label;
  const annotations: ChartAnnotation[] =
    incomplete && last !== undefined
      ? [
          {
            kind: "line",
            axis: "x",
            value: last,
            label: t("report.indicators.flows.progress"),
            labelPlacement: "start",
          },
        ]
      : [];

  return (
    <Chart
      variant="card"
      size="sm"
      title={t("report.indicators.flows.title")}
      description={t("report.indicators.flows.description")}
      data={data}
      series={series}
      x={{ field: "label" }}
      y={{ format: format.wholeMoney }}
      annotations={annotations}
      texture
    />
  );
}
