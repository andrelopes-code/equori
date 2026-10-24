import { Chart } from "@slotted/react/chart";
import type { ChartSeries } from "@slotted/core/chart";
import { useMemo } from "react";

import { balanceRows } from "@/features/overview/balance-rows";
import { useOverview } from "@/features/overview/use-overview";
import { formatDayMonth } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { QueryError } from "@/ui/query-error";

// The Available accounts day by day: the balance up to today, then the forecast, dashed.
export function BalanceChartBlock({ month }: { month: string }) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const today = useToday();
  const { overview, scale, failed, retry } = useOverview(month);
  const data = useMemo(
    () =>
      balanceRows(overview?.days ?? []).map((row) => ({
        ...row,
        label: formatDayMonth(row.date, locale),
      })),
    [overview, locale],
  );
  if (failed !== null) return <QueryError error={failed} onRetry={retry} />;
  const money = (value: number) =>
    overview === undefined || scale === null
      ? ""
      : fmt.money(
          { amount: value, currency: overview.base },
          scale(overview.base),
        );
  const series: ChartSeries[] = [
    {
      id: "balance",
      kind: "line",
      field: "balance",
      label: t("overview.balance.balance"),
      format: money,
    },
    {
      id: "projection",
      kind: "line",
      field: "projection",
      label: t("overview.balance.projection"),
      stroke: "dashed",
      format: money,
    },
  ];
  return (
    <Chart
      variant="card"
      size="sm"
      loading={overview === undefined}
      title={t("overview.balance.title")}
      data={data}
      series={series}
      x={{ field: "label" }}
      y={{ format: money }}
      annotations={
        overview?.current === true
          ? [
              {
                kind: "line",
                axis: "x",
                value: formatDayMonth(today, locale),
                label: t("overview.balance.today"),
              },
            ]
          : []
      }
    />
  );
}
