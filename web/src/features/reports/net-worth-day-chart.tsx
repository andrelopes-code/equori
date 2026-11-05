import type { ChartPoint, ChartSeries } from "@slotted/core/chart";
import { Chart, ChartTooltipContent } from "@slotted/react/chart";

import { eventLines } from "@/features/overview";
import type { ForecastEvent } from "@/features/overview";
import { NetWorthForecastLines } from "@/features/reports/net-worth-forecast-lines";
import { netWorthRows } from "@/features/reports/net-worth-rows";
import type { NetWorthForecast } from "@/features/reports/use-net-worth-forecast";
import { formatDayMonth } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { axisFloor } from "@/ui/axis-floor";

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
  const series: ChartSeries<"date" | "label" | "net" | "forecast">[] = [
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
  ];
  const points = new Map(
    (forecast?.points ?? [])
      .filter((point) => point.date > today)
      .map((point) => [label(point.date), point]),
  );
  const annotations =
    forecast === undefined
      ? []
      : eventLines([{ events: forecastEvents(forecast, t) }], label);
  const values = data.flatMap((row) =>
    [row.net, row.forecast].filter((value) => value !== null),
  );

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
      y={{ format: money, min: axisFloor(values) }}
      annotations={annotations}
      selectable
      onSelectionChange={handleSelect}
      renderTooltip={(context, model) => (
        <>
          <ChartTooltipContent context={context} model={model} />
          <NetWorthForecastLines
            point={points.get(context.point.key)}
            currency={currency}
            digits={digits}
          />
        </>
      )}
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
