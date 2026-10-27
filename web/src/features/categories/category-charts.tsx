import type { ChartSeries, ChartSlot } from "@slotted/core/chart";
import { Chart } from "@slotted/react/chart";
import { Grid } from "@slotted/react/grid";
import { useMemo } from "react";

import type { Trend } from "@/features/categories/category-figures";
import { compositionRows } from "@/features/categories/composition-rows";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

function isSlot(color: number | undefined): color is ChartSlot {
  return color !== undefined && color >= 1 && color <= 8;
}

// OV-05: two peer tiles in one grid, each a chart with its own title. The composition ranks the
// last month's top-level groups as bars with their share; the trend stacks one series per group
// in the group's own colour, so a colour means the same group there, in the tree and on the rows.
export function CategoryCharts({
  trend,
  currency,
  scale,
  loading,
}: {
  trend: Trend;
  currency: string;
  scale: number;
  loading: boolean;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();

  const { months, composition, series } = useMemo(() => {
    const money = (value: number) =>
      fmt.money({ amount: value, currency }, scale);
    const short = new Intl.DateTimeFormat(locale, {
      month: "short",
      timeZone: "UTC",
    });
    const label = (month: string) => short.format(new Date(`${month}-01`));
    const all: ChartSeries[] = trend.groups.map((g) => ({
      id: g.id,
      kind: "bar",
      field: g.id,
      label: g.name,
      stack: "total",
      format: money,
      ...(isSlot(g.color) ? { slot: g.color } : {}),
    }));
    if (trend.records.some((r) => Number(r.pending) !== 0)) {
      all.push({
        id: "pending",
        kind: "bar",
        field: "pending",
        label: t("category.pending"),
        stack: "total",
        tone: "neutral",
        format: money,
      });
    }
    const records: Record<string, string | number>[] = trend.records.map(
      (r) => ({
        ...r,
        label: label(String(r.month)),
      }),
    );
    const last = records[records.length - 1];
    return {
      months: records,
      composition:
        last === undefined
          ? []
          : compositionRows(
              all.map((g) => ({ field: g.field, label: g.label ?? g.field })),
              last,
              locale,
            ),
      series: all,
    };
  }, [trend, currency, scale, locale, t, fmt]);

  const empty = !months.some((r) => series.some((s) => Number(r[s.field]) > 0));
  return (
    <Grid gap={4} minItemWidth="lg">
      <Chart
        variant="card"
        size="sm"
        orientation="horizontal"
        loading={loading}
        data={empty ? [] : composition}
        series={[
          {
            id: "amount",
            kind: "bar",
            field: "amount",
            label: t("category.chart.amount"),
            format: (value) => fmt.money({ amount: value, currency }, scale),
          },
        ]}
        title={t("category.chart.composition")}
        x={{ field: "label" }}
        y={{
          format: (value) => fmt.money({ amount: value, currency }, scale),
        }}
      />
      <Chart
        variant="card"
        size="sm"
        legendOverflow="wrap"
        loading={loading}
        data={empty ? [] : months}
        series={series}
        title={t("category.chart.trend")}
        description={t("category.chart.trendDescription")}
        x={{ field: "label" }}
        y={{
          format: (value) => fmt.money({ amount: value, currency }, scale),
        }}
      />
    </Grid>
  );
}
