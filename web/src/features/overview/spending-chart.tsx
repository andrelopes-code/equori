import { Chart } from "@slotted/react/chart";
import type { ChartSeries } from "@slotted/core/chart";

import styles from "@/features/overview/chart-fill.module.css";
import {
  OverviewBlock,
  type Placement,
} from "@/features/overview/overview-block";
import { useSpending } from "@/features/overview/use-spending";
import { formatMonthName } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

// The desk draws the ranking as bars.
export function SpendingChart({
  month,
  ...placement
}: { month: string } & Placement) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const { base, scale, error, loading, rows, retry } = useSpending(month);
  const digits = scale === null || base === undefined ? 0 : scale(base);
  const money = (value: number) =>
    base === undefined
      ? ""
      : fmt.money({ amount: value, currency: base }, digits);
  const series: ChartSeries[] = [
    {
      id: "amount",
      kind: "bar",
      field: "amount",
      label: t("overview.spending.amount"),
      format: money,
    },
  ];
  return (
    <OverviewBlock
      placement={placement}
      link={{
        label: t("overview.spending.open"),
        options: { to: "/categories" },
      }}
      loading={loading || (error === null && base === undefined)}
      error={error}
      onRetry={retry}
      empty={
        rows.length === 0
          ? t("overview.spending.empty", {
              month: formatMonthName(month, locale).toLocaleLowerCase(locale),
            })
          : undefined
      }
    >
      {rows.length > 0 && base !== undefined && (
        <div className={styles.fill}>
          <div className={styles.plot}>
            <Chart
              orientation="horizontal"
              title={t("overview.spending.amount")}
              data={rows.map((row) => ({ name: row.name, amount: row.amount }))}
              series={series}
              x={{ field: "name" }}
              y={{ format: money }}
            />
          </div>
        </div>
      )}
    </OverviewBlock>
  );
}
