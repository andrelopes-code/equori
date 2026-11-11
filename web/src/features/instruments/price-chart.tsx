import type { ChartAnnotation, ChartSeries } from "@slotted/core/chart";
import { Chart } from "@slotted/react/chart";
import { useMemo } from "react";

import type { components } from "@/api/schema.gen";
import {
  axisLabel,
  axisSpanDays,
  axisTicks,
} from "@/features/instruments/price-axis";
import { usePriceFormat } from "@/features/instruments/use-price-format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

type Price = components["schemas"]["Price"];

interface PriceChartProps {
  prices: readonly Price[];
  quote: string;
  loading: boolean;
  // The average cost of the book's positions, drawn as a reference line (IP6).
  averageCost?: number | null | undefined;
  onActiveDateChange?: ((date: string | null) => void) | undefined;
}

type Field = "date" | "price" | "manual";

// A price is an exact decimal that the chart plots as a number; nothing is computed from it. A
// manual price outranks the feeds (MQ1) and is marked, because it can depart from them (IP5).
export function PriceChart({
  prices,
  quote,
  loading,
  averageCost = null,
  onActiveDateChange,
}: PriceChartProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const format = usePriceFormat(quote);
  const data = useMemo(
    () =>
      [...prices]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((p) => ({
          date: p.date,
          price: Number(p.value),
          manual: p.source === "manual" ? Number(p.value) : null,
        })),
    [prices],
  );
  const span = axisSpanDays(data);
  const ticks = axisTicks(
    Date.parse(data[0]?.date ?? ""),
    Date.parse(data.at(-1)?.date ?? ""),
  );
  const hasManual = data.some((d) => d.manual !== null);
  const series: ChartSeries<Field>[] = [
    {
      id: "price",
      kind: "line",
      field: "price",
      label: t("instrument.chart.title"),
      format: format.number,
      markers: "last",
    },
    ...(hasManual
      ? [
          {
            id: "manual",
            kind: "scatter",
            field: "manual",
            label: t("instrument.chart.manual"),
            format: format.number,
          } satisfies ChartSeries<Field>,
        ]
      : []),
  ];
  // A reference outside the plotted prices would stretch the axis away from the line (IP6).
  const annotations: ChartAnnotation[] =
    averageCost === null || !within(data, averageCost)
      ? []
      : [
          {
            kind: "line",
            axis: "start",
            value: averageCost,
            label: `${t("instrument.chart.averageCost")} ${format.number(averageCost)}`,
            tone: "secondary",
          },
        ];

  return (
    <Chart
      variant="card"
      size="md"
      loading={loading}
      aria-label={t("instrument.prices.title")}
      legend={hasManual}
      legendInteractive={false}
      data={data}
      series={series}
      annotations={annotations}
      x={{
        field: "date",
        type: "time",
        format: (value) => axisLabel(value, locale, span),
      }}
      y={{ format: format.tick }}
      extendOption={(option) => withTicks(option, ticks)}
      onActivePointChange={(point) => {
        onActiveDateChange?.(point === null ? null : point.key);
      }}
    />
  );
}

// The engine places the labels of a time axis by its own rule, a weekly step beside the first of
// each month (F4). The option is the engine's, read as loose data (its x axis is a list of one);
// this stays until the family exposes the tick positions.
function withTicks(option: Record<string, unknown>, ticks: number[]) {
  const axes = option.xAxis;
  if (!Array.isArray(axes)) return option;

  return {
    ...option,
    xAxis: axes.map((axis: unknown) => {
      if (typeof axis !== "object" || axis === null) return axis;

      const label: unknown = Reflect.get(axis, "axisLabel");
      const axisLabel =
        typeof label === "object" && label !== null ? label : {};

      return { ...axis, axisLabel: { ...axisLabel, customValues: ticks } };
    }),
  };
}

function within(data: readonly { price: number }[], value: number): boolean {
  return (
    data.some((d) => d.price <= value) && data.some((d) => d.price >= value)
  );
}
