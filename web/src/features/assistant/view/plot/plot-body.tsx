import { Chart } from "@slotted/react/chart";
import type { ChartSeries } from "@slotted/core/chart";

import { useValueFormat } from "@/features/assistant/view/use-value-format";
import {
  plotRecords,
  withNumber,
} from "@/features/assistant/view/plot/plot-records";
import { valueText } from "@/features/assistant/view/value-text";
import type { ViewPlot, ViewValue } from "@/features/assistant/view/view-types";
import { useAppLocale } from "@/i18n/i18n-provider";

interface PlotBodyProps {
  title: string;
  plot: ViewPlot;
  rows: ViewValue[][];
  // The table as written: the head keys translated and each value formatted.
  head: string[];
  labels: string[][];
}

// The rows of a view drawn as the chart the model chose (answer views design, V25). Every number
// goes back through its unit's formatter, so privacy mode masks amounts.
export function PlotBody({ title, plot, rows, head, labels }: PlotBodyProps) {
  const [locale] = useAppLocale();
  const format = useValueFormat();

  const { records, series } = plotRecords(rows, labels, plot);
  const first = series[0];
  const write = (unit: ViewValue) => (n: number) =>
    valueText(withNumber(unit, n), format);
  const kind = plot.chart === "column" ? "bar" : plot.chart;
  const drawn: ChartSeries[] = series.map((s) => ({
    id: s.field,
    kind,
    field: s.field,
    label: head[s.column] ?? "",
    format: write(s.unit),
    ...(kind === "pie" && { innerRadius: 0.6 }),
  }));

  return (
    <Chart
      aria-label={title}
      size="sm"
      toolbar="none"
      locale={locale}
      legend={series.length > 1 || kind === "pie"}
      trigger={kind === "pie" ? "item" : "axis"}
      orientation={plot.chart === "bar" ? "horizontal" : "vertical"}
      data={records}
      series={drawn}
      x={{ field: "label" }}
      y={first === undefined ? undefined : { format: write(first.unit) }}
    />
  );
}
