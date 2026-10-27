import type { ChartSeries } from "@slotted/core/chart";
import { Chart } from "@slotted/react/chart";
import { Grid } from "@slotted/react/grid";
import { Skeleton } from "@slotted/react/skeleton";
import { Stack } from "@slotted/react/stack";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { indicatorsQuery } from "@/features/overview";
import { indicatorRows } from "@/features/reports/indicator-rows";
import { ReportControls } from "@/features/reports/report-controls";
import { useScale } from "@/features/setup";
import {
  formatBasisPoints,
  formatMonths,
  formatReferenceMonth,
} from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { MonthControl } from "@/ui/month-control";
import { QueryError } from "@/ui/query-error";

// One line chart per indicator over the 12 months ending at month, each on its own value axis
// (analytics design 6).
export function IndicatorsTab({
  month,
  onMonth,
}: {
  month: string;
  onMonth: (month: string) => void;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const scale = useScale();
  const query = useQuery(indicatorsQuery(useApi(), month));
  const report = query.data;
  const percent = (bp: number) => formatBasisPoints(bp, locale);
  const months = (bp: number) =>
    t("overview.indicators.months", { months: formatMonths(bp, locale) });
  const controls = (
    <ReportControls
      start={
        <MonthControl
          value={month}
          onChange={onMonth}
          label={t("report.indicators.month")}
        />
      }
    />
  );
  if (query.error !== null)
    return (
      <Stack gap={4}>
        {controls}
        <QueryError error={query.error} onRetry={() => void query.refetch()} />
      </Stack>
    );
  if (report === undefined || scale === null)
    return (
      <Stack gap={4}>
        {controls}
        <Skeleton shape="block" blockSize="16rem" />
      </Stack>
    );
  const digits = scale(report.currency);
  const money = (amount: number) =>
    fmt.money({ amount, currency: report.currency }, digits);
  // A spread object, not the interface, satisfies the chart's record type.
  const data = indicatorRows(report, (m) =>
    formatReferenceMonth(m, locale),
  ).map((row) => ({ ...row }));
  const line = (
    id: string,
    label: string,
    format: (value: number) => string,
    stroke: "solid" | "dashed" = "solid",
  ): ChartSeries => ({ id, kind: "line", field: id, label, format, stroke });
  const chart = (
    title: string,
    series: ChartSeries[],
    format: (v: number) => string,
  ) => (
    <Chart
      variant="card"
      size="sm"
      title={title}
      description={t("report.indicators.description")}
      data={data}
      series={series}
      x={{ field: "label" }}
      y={{ format }}
    />
  );
  return (
    <Stack gap={4}>
      {controls}
      <Grid gap={4} minItemWidth="lg">
        {chart(
          t("report.indicators.savings"),
          [
            line("savings", t("report.indicators.savings"), percent),
            line(
              "trailing",
              t("report.indicators.trailing"),
              percent,
              "dashed",
            ),
          ],
          percent,
        )}
        {chart(
          t("report.indicators.reserve"),
          [line("liquidity", t("report.indicators.reserve"), months)],
          months,
        )}
        {chart(
          t("report.indicators.committed"),
          [line("committed", t("report.indicators.committed"), percent)],
          percent,
        )}
        {chart(
          t("report.indicators.debt"),
          [line("debt", t("report.indicators.debt"), percent)],
          percent,
        )}
        {chart(
          t("report.indicators.liabilities"),
          [line("liabilities", t("report.indicators.liabilities"), money)],
          money,
        )}
      </Grid>
    </Stack>
  );
}
