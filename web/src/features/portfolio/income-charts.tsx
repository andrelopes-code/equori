import type { ChartSeries } from "@slotted/core/chart";
import { Chart } from "@slotted/react/chart";
import { Grid } from "@slotted/react/grid";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { incomeChart } from "@/features/portfolio/year-figures";
import { instrumentsQuery, useScale } from "@/features/setup";
import { formatReferenceMonth } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

type Event = components["schemas"]["IncomeEvent"];

interface IncomeChartsProps {
  items: readonly Event[];
  from: string;
  to: string;
}

// PC14: when the money came and from which investment, peer tiles of one currency (OV-05).
export function IncomeCharts({ items, from, to }: IncomeChartsProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const api = useApi();
  const fmt = useMoneyFormat();
  const scale = useScale();
  const instruments = useQuery(instrumentsQuery(api));

  const chart = incomeChart(items, from, to);
  const currency = chart.currency ?? "";
  const money = (amount: number) =>
    fmt.money({ amount, currency }, scale?.(currency) ?? 0);
  const names = new Map(
    (instruments.data?.items ?? []).map((i) => [i.code, i.name]),
  );
  const series: ChartSeries<"net" | "name">[] = [
    {
      id: "net",
      kind: "bar",
      field: "net",
      label: t("holdings.income.net"),
      format: money,
    },
  ];
  const months = chart.months.map((m) => ({
    name: formatReferenceMonth(m.month, tag),
    net: m.net,
  }));
  const investments = chart.investments.map((i) => ({
    name: names.get(i.code) ?? i.code,
    net: i.net,
  }));
  const rankTitle =
    chart.total > investments.length
      ? t("holdings.income.top", { count: investments.length })
      : t("holdings.income.byInvestment");

  return (
    <Grid minItemWidth="md" gap={4}>
      <Chart
        variant="card"
        size="sm"
        title={t("holdings.income.byMonth")}
        data={months}
        series={series}
        x={{ field: "name" }}
        y={{ format: money }}
        legend={false}
        trigger="item"
        toolbar="hover"
      />
      <Chart
        variant="card"
        size="sm"
        orientation="horizontal"
        title={rankTitle}
        data={investments}
        series={series}
        x={{ field: "name" }}
        y={{ format: money }}
        legend={false}
        trigger="item"
        toolbar="hover"
      />
    </Grid>
  );
}
