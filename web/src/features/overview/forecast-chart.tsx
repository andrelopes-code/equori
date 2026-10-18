import { Chart } from "@slotted/react/chart";
import type { ChartAnnotation } from "@slotted/react/chart";
import { useMemo } from "react";

import { annotatedEvents } from "@/features/overview/forecast";
import { ForecastTooltip } from "@/features/overview/forecast-tooltip";
import type { Overview } from "@/features/overview/use-overview";
import { formatPlain } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";

// Complete frontend O4: realized in the neutral tone, forecast dashed in the accent tone,
// a line on today and on the largest occurrences still to come.
export function ForecastChart({
  overview,
  scale,
}: {
  overview: Overview;
  scale: (currency: string) => number;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const today = useToday();
  const s = scale(overview.base);
  const data = useMemo(
    () =>
      overview.days.map((day) => ({
        date: day.date,
        realized:
          day.realized === undefined
            ? null
            : Number(formatPlain(day.realized, s)),
        forecast:
          day.forecast === undefined
            ? null
            : Number(formatPlain(day.forecast, s)),
      })),
    [overview.days, s],
  );
  const annotations: ChartAnnotation[] = [
    ...(overview.current
      ? [
          {
            kind: "line" as const,
            axis: "x" as const,
            value: today,
            label: t("overview.chart.today"),
            tone: "accent" as const,
          },
        ]
      : []),
    ...annotatedEvents(
      overview.ahead,
      overview.current ? today : undefined,
    ).map((event) => ({
      kind: "line" as const,
      axis: "x" as const,
      value: event.date,
      label: event.description,
      tone: "neutral" as const,
    })),
  ];
  return (
    <Chart
      title={t("overview.chart")}
      data={data}
      series={[
        {
          kind: "line",
          field: "realized",
          label: t("overview.chart.realized"),
          curve: "step",
          tone: "neutral",
        },
        ...(overview.current
          ? [
              {
                kind: "line" as const,
                field: "forecast",
                label: t("overview.chart.forecast"),
                curve: "step" as const,
                tone: "accent" as const,
                stroke: "dashed" as const,
              },
            ]
          : []),
      ]}
      x={{ field: "date", type: "time", format: { day: "numeric" } }}
      y={{
        format: {
          style: "currency",
          currency: overview.base,
          notation: "compact",
          maximumFractionDigits: 1,
        },
      }}
      annotations={annotations}
      locale={locale}
      legend={false}
      toolbar="hover"
      size="md"
      // A balance reads its range, not its distance from zero, and steps on the day it moves.
      extendOption={(option) => {
        const axis = (value: unknown) => ({
          ...(value as Record<string, unknown>),
          scale: true,
          min: (extent: { min: number; max: number }) =>
            Math.floor((extent.min - (extent.max - extent.min) * 0.15) / 1000) *
            1000,
        });
        const series = Array.isArray(option.series)
          ? option.series.map((one: Record<string, unknown>) => ({
              ...one,
              step: "end",
            }))
          : option.series;
        return {
          ...option,
          series,
          yAxis: Array.isArray(option.yAxis)
            ? option.yAxis.map(axis)
            : axis(option.yAxis),
        };
      }}
      renderTooltip={(context) => {
        const day = overview.days.find(
          (d) => d.date === context.point.key || d.date === context.title,
        );
        return day === undefined ? null : (
          <ForecastTooltip
            day={day}
            today={today}
            currency={overview.base}
            scale={s}
          />
        );
      }}
    />
  );
}
