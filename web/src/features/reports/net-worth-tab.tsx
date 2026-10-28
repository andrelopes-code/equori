import type { ChartSeries } from "@slotted/core/chart";
import { Chart } from "@slotted/react/chart";
import { Segment, SegmentedControl } from "@slotted/react/segmented-control";
import { Stack } from "@slotted/react/stack";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableColumnHeader,
  TableContent,
  TableHead,
  TableLoader,
  TableRow,
  TableRowHeader,
} from "@slotted/react/table";
import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";

import { useApi } from "@/api/api-context";
import { netWorthQuery } from "@/features/overview";
import { monthEnds, netWorthRows } from "@/features/reports/net-worth-months";
import { ReportControls } from "@/features/reports/report-controls";
import { netWorthSpans } from "@/features/reports/reports-search";
import type { NetWorthMonths } from "@/features/reports/reports-search";
import { ValuationCurrency } from "@/features/reports/valuation-currency";
import { useScale } from "@/features/setup";
import { formatReferenceMonth, formatSignedBasisPoints } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { useMoneyFormat } from "@/privacy/use-money-format";

// Assets, liabilities and net at the end of each month, one request per month; the current
// month ends on today. A month that cannot be valued stays out of the chart and the other
// months stay.
export function NetWorthTab({
  count,
  valueIn,
  onCount,
  onValueIn,
}: {
  count: NetWorthMonths;
  valueIn: string | undefined;
  onCount: (count: NetWorthMonths) => void;
  onValueIn: (code: string) => void;
}) {
  const t = useT();
  const api = useApi();
  const today = useToday();
  const [tag] = useAppLocale();
  const fmt = useMoneyFormat();
  const scale = useScale();
  const months = useMemo(() => monthEnds(today, count), [today, count]);
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
  const none = t("report.none");
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
  return (
    <Stack gap={4}>
      <ReportControls
        start={
          <SegmentedControl
            aria-label={t("report.netWorth.span")}
            value={String(count)}
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
      {!pending && (
        <Chart
          variant="card"
          size="sm"
          title={title}
          data={data}
          series={series}
          x={{ field: "label" }}
          y={{ format: money }}
        />
      )}
      <Table columns={6} variant="framed">
        <TableContent>
          <TableCaption>{title}</TableCaption>
          <TableHead>
            <TableRow>
              <TableColumnHeader>{t("report.month")}</TableColumnHeader>
              <TableColumnHeader numeric>
                {t("report.netWorth.assets")}
              </TableColumnHeader>
              <TableColumnHeader numeric>
                {t("report.netWorth.liabilities")}
              </TableColumnHeader>
              <TableColumnHeader numeric>
                {t("report.netWorth.net")}
              </TableColumnHeader>
              <TableColumnHeader numeric>
                {t("report.change")}
              </TableColumnHeader>
              <TableColumnHeader numeric>
                {t("report.changePercent")}
              </TableColumnHeader>
            </TableRow>
          </TableHead>
          {pending ? (
            <TableLoader skeletonRows={6} />
          ) : (
            <TableBody>
              {rows
                .slice()
                .reverse()
                .map((r) => (
                  <TableRow key={r.month} value={r.month}>
                    <TableRowHeader>{label(r.month)}</TableRowHeader>
                    <TableCell numeric>
                      {r.assets === undefined ? none : money(r.assets)}
                    </TableCell>
                    <TableCell numeric>
                      {r.liabilities === undefined
                        ? none
                        : money(r.liabilities)}
                    </TableCell>
                    <TableCell numeric>
                      {r.net === undefined ? none : money(r.net)}
                    </TableCell>
                    <TableCell numeric>
                      {r.change === undefined
                        ? none
                        : fmt.signed({ amount: r.change, currency }, digits)}
                    </TableCell>
                    <TableCell numeric>
                      {r.changeBP === undefined
                        ? none
                        : formatSignedBasisPoints(r.changeBP, tag)}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          )}
        </TableContent>
      </Table>
    </Stack>
  );
}
