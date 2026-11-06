import type { ChartSeries, ChartSlot } from "@slotted/core/chart";
import { Chart } from "@slotted/react/chart";
import { Grid } from "@slotted/react/grid";
import { useMemo } from "react";

import type { components } from "@/api/schema.gen";
import type { Trend } from "@/features/categories/category-figures";
import type { CategoryEntry } from "@/features/categories/category-paths";
import { CompositionChart } from "@/features/categories/composition-chart";
import { compositionRows } from "@/features/categories/composition-rows";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

type CategoryTotal = components["schemas"]["CategoryTotal"];

function isSlot(color: number | undefined): color is ChartSlot {
  return color !== undefined && color >= 1 && color <= 8;
}

// OV-05: two peer tiles in one grid, each a chart with its own title. The composition ranks the
// last month's top-level groups as bars with their share; the trend stacks one series per group
// in the group's own colour, so a colour means the same group there, in the tree and on the rows.
export function CategoryCharts({
  trend,
  entries,
  items,
  currency,
  scale,
  loading,
}: {
  trend: Trend;
  entries: readonly CategoryEntry[];
  items: readonly CategoryTotal[] | undefined;
  currency: string;
  scale: number;
  loading: boolean;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();

  const { months, composition, series, fields } = useMemo(() => {
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
    const fields = trend.groups.map((g) => ({ field: g.id, label: g.name }));
    if (trend.records.some((r) => Number(r.pending) !== 0)) {
      fields.push({ field: "pending", label: t("category.pending") });
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
        last === undefined ? [] : compositionRows(fields, last, locale),
      series: all,
      fields,
    };
  }, [trend, currency, scale, locale, t, fmt]);

  const empty = !months.some((r) => fields.some((s) => Number(r[s.field]) > 0));
  return (
    <Grid gap={4} minItemWidth="lg">
      <CompositionChart
        rows={empty ? [] : composition}
        entries={entries}
        items={items}
        currency={currency}
        scale={scale}
        loading={loading}
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
