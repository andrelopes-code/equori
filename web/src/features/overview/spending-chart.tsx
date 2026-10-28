import { Chart } from "@slotted/react/chart";
import type { ChartSeries } from "@slotted/core/chart";

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
  const series: ChartSeries<"amount" | "name">[] = [
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
        <Chart
          orientation="horizontal"
          aria-label={t("overview.spending.title")}
          data={rows.map((row) => ({ name: row.name, amount: row.amount }))}
          series={series}
          x={{ field: "name" }}
          y={{ format: money }}
        />
      )}
    </OverviewBlock>
  );
}
