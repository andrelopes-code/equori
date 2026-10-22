import { Chart } from "@slotted/react/chart";
import type { ChartSeries } from "@slotted/core/chart";
import { Segment, SegmentedControl } from "@slotted/react/segmented-control";
import { useQuery } from "@tanstack/react-query";
import { memo, useMemo } from "react";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { projectionQuery, seriesQuery } from "@/features/accounts/api";
import type { Range } from "@/features/accounts/account-search";
import { projectionDays } from "@/features/accounts/account-figures";
import { balanceChartRows } from "@/features/accounts/balance-chart-rows";
import { formatDayMonth, formatMoney, shiftDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";

type Account = components["schemas"]["Account"];

// The balance day by day over the range, then the balance the schedules lead to, dashed, up to
// 30 days ahead; a line marks today between the two.
// Memoised: a tab switch changes the address, and the figures and the chart above the tabs
// do not depend on it, so they skip that render.
export const BalanceChart = memo(function BalanceChart({
  account,
  range,
  onRange,
  scale,
}: {
  account: Account;
  range: Range;
  onRange: (range: Range) => void;
  scale: number;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const api = useApi();
  const today = useToday();
  const from = shiftDate(today, -(range - 1));
  const series = useQuery(seriesQuery(api, account.id, from, today));
  const leaf = account.class === "asset" || account.class === "liability";
  const projection = useQuery({
    ...projectionQuery(api, account.id, shiftDate(today, projectionDays)),
    enabled: leaf && account.closed_on === undefined,
  });

  const data = useMemo(
    () =>
      balanceChartRows(
        series.data?.items ?? [],
        projection.data,
        today,
        shiftDate(today, projectionDays),
      ).map((row) => ({ ...row, label: formatDayMonth(row.date, locale) })),
    [series.data, projection.data, today, locale],
  );

  const money = (value: number) =>
    formatMoney({ amount: value, currency: account.currency }, scale, locale);
  const chartSeries: ChartSeries[] = [
    {
      id: "balance",
      kind: "line",
      field: "balance",
      label: t("account.chart.balance"),
      format: money,
    },
    {
      id: "projection",
      kind: "line",
      field: "projection",
      label: t("account.chart.projection"),
      stroke: "dashed",
      format: money,
    },
  ];
  return (
    <Chart
      variant="card"
      size="sm"
      loading={series.isPending}
      title={t("account.chart.title")}
      data={data}
      series={chartSeries}
      x={{ field: "label" }}
      y={{ format: money }}
      annotations={[
        {
          kind: "line",
          axis: "x",
          value: formatDayMonth(today, locale),
          label: t("account.chart.today"),
        },
      ]}
      actions={
        <SegmentedControl
          size="sm"
          aria-label={t("account.chart.range")}
          value={String(range)}
          onValueChange={(value) => {
            const next = Number(value);
            if (next === 30 || next === 90 || next === 365) onRange(next);
          }}
        >
          <Segment value="30">{t("account.chart.days", { count: 30 })}</Segment>
          <Segment value="90">{t("account.chart.days", { count: 90 })}</Segment>
          <Segment value="365">{t("account.chart.year")}</Segment>
        </SegmentedControl>
      }
    />
  );
});
