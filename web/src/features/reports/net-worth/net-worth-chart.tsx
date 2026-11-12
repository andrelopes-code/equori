import type { ChartPoint, ChartSeries } from "@slotted/core/chart";
import { Chart } from "@slotted/react/chart";

import type { NetWorthRow } from "@/features/reports/model/net-worth-months";
import { formatReferenceMonth } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

interface NetWorthChartProps {
  rows: readonly NetWorthRow[];
  currency: string;
  digits: number;
  onSelectionChange: (point: ChartPoint | null) => void;
}

// A month that cannot be valued stays out of the lines and the other months stay.
export function NetWorthChart({
  rows,
  currency,
  digits,
  onSelectionChange,
}: NetWorthChartProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const fmt = useMoneyFormat();

  const money = (amount: number) => fmt.money({ amount, currency }, digits);
  const series: ChartSeries<"label" | "assets" | "liabilities" | "net">[] = [
    {
      id: "net",
      kind: "line",
      field: "net",
      label: t("report.netWorth.net"),
      format: money,
    },
    {
      id: "assets",
      kind: "line",
      field: "assets",
      label: t("report.netWorth.assets"),
      format: money,
    },
    {
      id: "liabilities",
      kind: "line",
      field: "liabilities",
      label: t("report.netWorth.liabilities"),
      format: money,
    },
  ];
  const data = rows.map((r) => ({
    label: formatReferenceMonth(r.month, tag),
    net: r.net ?? null,
    assets: r.assets ?? null,
    liabilities: r.liabilities ?? null,
  }));

  return (
    <Chart
      variant="card"
      size="sm"
      title={t("report.netWorth.title")}
      data={data}
      series={series}
      x={{ field: "label" }}
      y={{ format: money }}
      selectable
      onSelectionChange={onSelectionChange}
    />
  );
}
