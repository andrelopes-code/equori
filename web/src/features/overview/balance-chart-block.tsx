import { Chart } from "@slotted/react/chart";
import type { ChartSeries } from "@slotted/core/chart";
import { useMemo } from "react";

import { balanceRows } from "@/features/overview/balance-rows";
import styles from "@/features/overview/chart-fill.module.css";
import {
  OverviewBlock,
  type Placement,
} from "@/features/overview/overview-block";
import { useOverview } from "@/features/overview/use-overview";
import { formatDayMonth } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { useMoneyFormat } from "@/privacy/use-money-format";

// The Available accounts day by day: the balance up to today, then the forecast, dashed.
export function BalanceChartBlock({
  month,
  ...placement
}: { month: string } & Placement) {
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
  const money = (value: number) =>
    overview === undefined || scale === null
      ? ""
      : fmt.money(
          { amount: value, currency: overview.base },
          scale(overview.base),
        );
  const series: ChartSeries<"label" | "date" | "balance" | "projection">[] = [
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
    <OverviewBlock
      placement={placement}
      loading={overview === undefined}
      error={failed}
      onRetry={retry}
    >
      <div className={styles.fill}>
        <div className={styles.plot}>
          <Chart
            title={t("overview.balance.balance")}
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
        </div>
      </div>
    </OverviewBlock>
  );
}
