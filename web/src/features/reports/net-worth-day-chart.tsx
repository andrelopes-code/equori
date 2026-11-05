import type { ChartPoint, ChartSeries } from "@slotted/core/chart";
import { Chart, ChartTooltipContent } from "@slotted/react/chart";

import { eventLines } from "@/features/overview";
import type { ForecastEvent } from "@/features/overview";
import { forecastDayMoves } from "@/features/reports/forecast-day-moves";
import { NetWorthForecastTooltip } from "@/features/reports/net-worth-forecast-tooltip";
import { netWorthRows } from "@/features/reports/net-worth-rows";
import type { NetWorthForecast } from "@/features/reports/use-net-worth-forecast";
import { formatDayMonth } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { useMoneyFormat } from "@/privacy/use-money-format";

interface NetWorthDayChartProps {
  title: string;
  days: readonly { date: string; net: { amount: number } }[];
  forecast: NetWorthForecast | undefined;
  currency: string;
  digits: number;
  loading: boolean;
  onDay: (date: string | undefined) => void;
}

// The net worth at the end of each day as a line, then its forecast to the month's end, dashed,
// with each scheduled amount and each recurring estimate marked on its day; a day picked names the entries beside it (net
// worth days design, D4; net worth forecast design, F2 to F11).
export function NetWorthDayChart({
  title,
  days,
  forecast,
  currency,
  digits,
  loading,
  onDay,
}: NetWorthDayChartProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const fmt = useMoneyFormat();
  const today = useToday();

  const label = (date: string) => formatDayMonth(date, tag);
  const data = netWorthRows(days, forecast?.points ?? []).map((row) => ({
    ...row,
    label: label(row.date),
  }));
  // An axis tick can fall between two minor units; the money format takes whole ones.
  const money = (amount: number) =>
    fmt.money({ amount: Math.round(amount), currency }, digits);
  const series: ChartSeries<
    "date" | "label" | "net" | "forecast" | "low" | "high"
  >[] = [
    {
      id: "net",
      kind: "line",
      field: "net",
      label: t("report.netWorth.net"),
      format: money,
    },
    {
      id: "forecast",
      kind: "line",
      field: "forecast",
      label: t("report.netWorth.forecast"),
      stroke: "dashed",
      format: money,
    },
    {
      id: "likely",
      kind: "range",
      lower: "low",
      upper: "high",
      of: "forecast",
      label: t("report.netWorth.range"),
      format: money,
    },
  ];
  const points = new Map(
    (forecast?.points ?? [])
      .filter((point) => point.date >= today)
      .map((point) => [label(point.date), point]),
  );
  const events = forecast === undefined ? [] : forecastEvents(forecast, t);
  const annotations = eventLines([{ events }], label);

  function handleSelect(point: ChartPoint | null) {
    const date = data.find((row) => row.label === point?.key)?.date;

    onDay(date === undefined || date > today ? undefined : date);
  }

  return (
    <Chart
      aria-label={title}
      loading={loading}
      data={data}
      series={forecast === undefined ? series.slice(0, 1) : series}
      x={{ field: "label" }}
      y={{ format: money }}
      annotations={annotations}
      selectable
      onSelectionChange={handleSelect}
      // Workaround for Slotted issue #76: a wide range value hides every row label of the
      // chart's tooltip, so today and the remaining days draw their own rows.
      renderTooltip={(context, model) => {
        const point = points.get(context.point.key);

        return point === undefined ? (
          <ChartTooltipContent context={context} model={model} />
        ) : (
          <NetWorthForecastTooltip
            point={point}
            moves={forecastDayMoves(events, point.date, today)}
            currency={currency}
            digits={digits}
          />
        );
      }}
    />
  );
}

// The scheduled occurrences, then the recurring estimates under their category's name.
function forecastEvents(
  forecast: NetWorthForecast,
  t: ReturnType<typeof useT>,
): ForecastEvent[] {
  return [
    ...forecast.events,
    ...forecast.recurring.map((estimate) => ({
      date: estimate.date,
      occurrenceID: "",
      description: t("report.netWorth.forecastRecurringLabel", {
        label: estimate.label,
      }),
      kind: undefined,
      amount: estimate.amount,
    })),
  ];
}
