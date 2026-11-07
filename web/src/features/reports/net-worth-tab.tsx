import type { ChartPoint, ChartSeries } from "@slotted/core/chart";
import { Chart } from "@slotted/react/chart";
import { Segment, SegmentedControl } from "@slotted/react/segmented-control";
import { Stack } from "@slotted/react/stack";
import { useQueries } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { useApi } from "@/api/api-context";
import { netWorthQuery } from "@/features/overview";
import { AssetsAllocation } from "@/features/portfolio";
import type { AllocationBy } from "@/features/portfolio";
import { NetWorthGrowthCards } from "@/features/reports/net-worth-growth-cards";
import {
  netWorthRows,
  periodMonthEnds,
} from "@/features/reports/net-worth-months";
import { NetWorthMonthCard } from "@/features/reports/net-worth-month-card";
import { NetWorthTable } from "@/features/reports/net-worth-table";
import { ReportControls } from "@/features/reports/report-controls";
import type { ReportPeriod } from "@/features/reports/report-period";
import { netWorthSpans } from "@/features/reports/reports-search";
import type { NetWorthMonths } from "@/features/reports/reports-search";
import { ValuationCurrency } from "@/features/reports/valuation-currency";
import { useScale } from "@/features/setup";
import { formatReferenceMonth } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { useMoneyFormat } from "@/privacy/use-money-format";

// Assets, liabilities and net at the end of each month of the period, one request per month; the
// current month ends on today (NP2). A month that cannot be valued stays out of the chart and the
// other months stay.
// shortcut: a period of years costs one request per month; a series endpoint replaces it when
// periods of several years become common.
export function NetWorthTab({
  count,
  period,
  valueIn,
  assetsBy,
  onCount,
  onValueIn,
  onAssetsBy,
}: {
  // The span checked, or undefined when the header's period is set (NP1).
  count: NetWorthMonths | undefined;
  period: ReportPeriod;
  valueIn: string | undefined;
  assetsBy: AllocationBy;
  onCount: (count: NetWorthMonths) => void;
  onValueIn: (code: string) => void;
  onAssetsBy: (by: AllocationBy) => void;
}) {
  const t = useT();
  const api = useApi();
  const today = useToday();
  const [tag] = useAppLocale();
  const fmt = useMoneyFormat();
  const scale = useScale();
  const [selected, setSelected] = useState<string>();
  const current = today.slice(0, 7);
  const months = useMemo(
    () => periodMonthEnds({ from: period.from, to: period.to }, today),
    [period.from, period.to, today],
  );
  const results = useQueries({
    queries: months.map((m) => ({
      ...netWorthQuery(api, m.date, valueIn ?? ""),
      enabled: valueIn !== undefined,
    })),
  });
  const rows = netWorthRows(
    months,
    results.map((r) => r.data),
  );
  const pending =
    valueIn === undefined || scale === null || results.some((r) => r.isPending);
  const digits = scale === null || valueIn === undefined ? 0 : scale(valueIn);
  const currency = valueIn ?? "";
  const money = (amount: number) => fmt.money({ amount, currency }, digits);
  const label = (month: string) => formatReferenceMonth(month, tag);
  const title = t("report.netWorth.title");
  const series: ChartSeries<"label" | "assets" | "liabilities" | "net">[] = [
    {
      id: "net",
      kind: "line",
      field: "net",
      label: t("report.netWorth.net"),
      format: money,
    },
    {
      id: "assets",
      kind: "line",
      field: "assets",
      label: t("report.netWorth.assets"),
      format: money,
    },
    {
      id: "liabilities",
      kind: "line",
      field: "liabilities",
      label: t("report.netWorth.liabilities"),
      format: money,
    },
  ];
  const data = rows.map((r) => ({
    label: label(r.month),
    net: r.net ?? null,
    assets: r.assets ?? null,
    liabilities: r.liabilities ?? null,
  }));

  // A point names its month by the x value; clearing the selection returns to the current month.
  // A month after the current one holds no net worth yet.
  function handleMonth(next: string) {
    setSelected(next > current ? current : next);
  }

  function handleSelect(point: ChartPoint | null) {
    setSelected(rows.find((r) => label(r.month) === point?.key)?.month);
  }

  return (
    <Stack gap={4}>
      <ReportControls
        start={
          <SegmentedControl
            aria-label={t("report.netWorth.span")}
            value={count === undefined ? "" : String(count)}
            onValueChange={(value) => {
              const next = netWorthSpans.find((n) => String(n) === value);
              if (next !== undefined) onCount(next);
            }}
          >
            {netWorthSpans.map((n) => (
              <Segment key={n} value={String(n)}>
                {t("report.netWorth.months", { count: n })}
              </Segment>
            ))}
          </SegmentedControl>
        }
        end={<ValuationCurrency value={valueIn} onChange={onValueIn} />}
      />
      {valueIn !== undefined && (
        <NetWorthGrowthCards
          period={period}
          closing={months.at(-1)?.date}
          valueIn={valueIn}
          digits={digits}
        />
      )}

      {!pending && (
        <Chart
          variant="card"
          size="sm"
          title={title}
          data={data}
          series={series}
          x={{ field: "label" }}
          y={{ format: money }}
          selectable
          onSelectionChange={handleSelect}
        />
      )}

      {valueIn !== undefined && (
        <NetWorthMonthCard
          month={selected ?? months.at(-1)?.month ?? current}
          valueIn={valueIn}
          onMonth={handleMonth}
        />
      )}

      <AssetsAllocation
        date={months.at(-1)?.date ?? today}
        valueIn={valueIn}
        by={assetsBy}
        onBy={onAssetsBy}
      />

      <NetWorthTable
        rows={rows}
        pending={pending}
        title={title}
        currency={currency}
        digits={digits}
      />
    </Stack>
  );
}
