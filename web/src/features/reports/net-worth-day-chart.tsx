import type { ChartPoint, ChartSeries } from "@slotted/core/chart";
import { Chart } from "@slotted/react/chart";

import { formatDayMonth } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { axisFloor } from "@/ui/axis-floor";

interface NetWorthDayChartProps {
  title: string;
  days: readonly { date: string; net: { amount: number } }[];
  currency: string;
  digits: number;
  loading: boolean;
  onDay: (date: string | undefined) => void;
}

// The net worth at the end of each day as a line; a day picked names the expenses beside it
// (net worth days design, D4).
export function NetWorthDayChart({
  title,
  days,
  currency,
  digits,
  loading,
  onDay,
}: NetWorthDayChartProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const fmt = useMoneyFormat();

  const data = days.map((day) => ({
    date: day.date,
    label: formatDayMonth(day.date, tag),
    net: day.net.amount,
  }));
  // An axis tick can fall between two minor units; the money format takes whole ones.
  const money = (amount: number) =>
    fmt.money({ amount: Math.round(amount), currency }, digits);
  const series: ChartSeries<"date" | "label" | "net">[] = [
    {
      id: "net",
      kind: "line",
      field: "net",
      label: t("report.netWorth.net"),
      format: money,
    },
  ];

  function handleSelect(point: ChartPoint | null) {
    onDay(data.find((row) => row.label === point?.key)?.date);
  }

  return (
    <Chart
      aria-label={title}
      loading={loading}
      data={data}
      series={series}
      x={{ field: "label" }}
      y={{ format: money, min: axisFloor(data.map((row) => row.net)) }}
      selectable
      onSelectionChange={handleSelect}
    />
  );
}
