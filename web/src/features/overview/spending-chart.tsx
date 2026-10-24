import { Chart } from "@slotted/react/chart";
import type { ChartSeries } from "@slotted/core/chart";

import { OverviewBlock } from "@/features/overview/overview-block";
import styles from "@/features/overview/spending-chart.module.css";
import { OverviewLink } from "@/features/overview/overview-link";
import { useSpending } from "@/features/overview/use-spending";
import { formatMonthName } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

// The desk draws the ranking as bars; loading, failure and an empty month keep the block.
export function SpendingChart({ month }: { month: string }) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const { base, scale, error, loading, rows, retry } = useSpending(month);
  if (loading || error !== null || rows.length === 0 || base === undefined)
    return (
      <OverviewBlock
        title={t("overview.spending.title")}
        loading={loading}
        error={error}
        onRetry={retry}
        empty={t("overview.spending.empty", {
          month: formatMonthName(month, locale).toLocaleLowerCase(locale),
        })}
      />
    );
  const digits = scale === null ? 0 : scale(base);
  const money = (value: number) =>
    fmt.money({ amount: value, currency: base }, digits);
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
    <Chart
      variant="card"
      size="sm"
      orientation="horizontal"
      title={t("overview.spending.title")}
      data={rows.map((row) => ({ name: row.name, amount: row.amount }))}
      series={series}
      x={{ field: "name" }}
      y={{ format: money }}
      actions={
        <div className={styles.actions}>
          <OverviewLink
            options={{ to: "/categories" }}
            label={t("overview.spending.open")}
          >
            {t("overview.open")}
          </OverviewLink>
        </div>
      }
    />
  );
}
