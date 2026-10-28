import type { ChartSeries } from "@slotted/core/chart";
import { Chart } from "@slotted/react/chart";
import { ListEmpty, ListSection } from "@slotted/react/list";
import { SkeletonText } from "@slotted/react/skeleton";
import { Stack } from "@slotted/react/stack";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableColumnHeader,
  TableContent,
  TableHead,
  TableRow,
  TableRowHeader,
} from "@slotted/react/table";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

import { useApi } from "@/api/api-context";
import { usageDaysQuery } from "@/features/setup/api";
import { usageDayRows } from "@/features/setup/usage-days";
import {
  formatDate,
  formatDayMonth,
  numberFormatter,
  shiftDate,
} from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { QueryError } from "@/ui/query-error";

const days = 30;
const xAxis = { field: "label" } as const;

// Requests and tokens per day over the last 30 days, summed over every provider and model,
// with a table of the days that had use as the text alternative of the charts.
export function UsageChart() {
  const t = useT();
  const api = useApi();
  const [tag] = useAppLocale();
  const to = useToday();
  const from = shiftDate(to, 1 - days);
  const query = useQuery(usageDaysQuery(api, from, to));
  const number = useMemo(() => numberFormatter(tag), [tag]);
  const rows = useMemo(
    () => usageDayRows(query.data ?? [], from, to),
    [query.data, from, to],
  );
  const used = rows.filter((r) => r.requests > 0 || r.tokens > 0);
  const data = useMemo(
    () => rows.map((r) => ({ ...r, label: formatDayMonth(r.day, tag) })),
    [rows, tag],
  );
  const format = useCallback((value: number) => number.format(value), [number]);
  const yAxis = useMemo(() => ({ format }), [format]);
  const charts = useMemo(
    () =>
      (["requests", "tokens"] as const).map((field) => ({
        field,
        series: [
          {
            id: field,
            kind: "bar",
            field,
            label: t(`assistant.usage.chart.${field}`),
            tone: "accent",
            format,
          },
        ] satisfies ChartSeries[],
      })),
    [t, format],
  );

  return (
    <ListSection label={t("assistant.usage.chart", { days: String(days) })}>
      {query.error !== null && (
        <QueryError
          error={query.error}
          onRetry={() => {
            void query.refetch();
          }}
        />
      )}
      {query.isPending && <SkeletonText lines={4} />}
      {query.data !== undefined && used.length === 0 && (
        <ListEmpty>
          {t("assistant.usage.chart.empty", { days: String(days) })}
        </ListEmpty>
      )}
      {query.data !== undefined && used.length > 0 && (
        <Stack gap={3}>
          {charts.map(({ field, series }) => (
            <Chart
              key={field}
              variant="card"
              size="sm"
              title={t(`assistant.usage.chart.${field}`)}
              data={data}
              series={series}
              x={xAxis}
              y={yAxis}
            />
          ))}
          <Table columns={4} variant="framed">
            <TableContent>
              <TableCaption>
                {t("assistant.usage.chart", { days: String(days) })}
              </TableCaption>
              <TableHead>
                <TableRow>
                  <TableColumnHeader>
                    {t("assistant.usage.day")}
                  </TableColumnHeader>
                  <TableColumnHeader numeric>
                    {t("assistant.usage.chart.requests")}
                  </TableColumnHeader>
                  <TableColumnHeader numeric>
                    {t("assistant.usage.chart.errors")}
                  </TableColumnHeader>
                  <TableColumnHeader numeric>
                    {t("assistant.usage.chart.tokens")}
                  </TableColumnHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {used.map((r) => (
                  <TableRow key={r.day} value={r.day}>
                    <TableRowHeader>{formatDate(r.day, tag)}</TableRowHeader>
                    <TableCell numeric>{number.format(r.requests)}</TableCell>
                    <TableCell numeric>{number.format(r.errors)}</TableCell>
                    <TableCell numeric>{number.format(r.tokens)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </TableContent>
          </Table>
        </Stack>
      )}
    </ListSection>
  );
}
