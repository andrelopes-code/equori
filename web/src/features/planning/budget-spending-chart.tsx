import type { ChartSeries } from "@slotted/core/chart";
import { Chart } from "@slotted/react/chart";

import { spendingBars } from "@/features/planning/spending-bars";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

export interface SpendingSlice {
  name: string;
  spent: number;
}

// Where the month's spending went: one bar per top category with budgets and one for what no
// budget covers, ranked, each labelled with its share; the total stands in the description.
export function BudgetSpendingChart({
  slices,
  currency,
  scale,
  loading,
}: {
  slices: readonly SpendingSlice[];
  currency: string;
  scale: number;
  loading: boolean;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const money = (amount: number) => fmt.money({ amount, currency }, scale);
  const total = slices.reduce((sum, s) => sum + Math.max(s.spent, 0), 0);
  const series: ChartSeries<"label" | "spent">[] = [
    {
      id: "spent",
      kind: "bar",
      field: "spent",
      label: t("budget.spent"),
      format: money,
    },
  ];
  return (
    <Chart
      variant="card"
      size="sm"
      orientation="horizontal"
      loading={loading}
      data={spendingBars(slices, locale)}
      series={series}
      title={t("budget.spendingChart")}
      description={t("budget.spentTotal", { amount: money(total) })}
      x={{ field: "label" }}
      y={{ format: money }}
    />
  );
}
