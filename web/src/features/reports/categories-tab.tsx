import type { ChartSeries } from "@slotted/core/chart";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
} from "@slotted/react/breadcrumb";
import { Chart } from "@slotted/react/chart";
import { InlineMessage } from "@slotted/react/inline-message";
import { Link } from "@slotted/react/link";
import {
  ResultState,
  ResultStateContent,
  ResultStateTitle,
} from "@slotted/react/result-state";
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
  TableSummary,
} from "@slotted/react/table";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useApi } from "@/api/api-context";
import { accountsQuery } from "@/features/accounts";
import { categoryTotalsQuery, useCategoryEntries } from "@/features/categories";
import { periodProblem } from "@/features/portfolio";
import { categoryRows } from "@/features/reports/category-rows";
import type { CategoryRow } from "@/features/reports/category-rows";
import { previousPeriod } from "@/features/reports/report-period";
import type { ReportPeriod } from "@/features/reports/report-period";
import type { ReportsSearch } from "@/features/reports/reports-search";
import { useReportLink } from "@/features/reports/use-report-link";
import { settingsQuery, useScale } from "@/features/setup";
import { formatSignedBasisPoints } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { QueryError } from "@/ui/query-error";
import { useAppLink } from "@/ui/use-app-link";

// A ranking draws ten bars (RE-08); the table holds every row.
const chartRows = 10;

// What a class booked in a period, one level of the category tree at a time: a category that
// has children opens them, and every row opens its transactions of the period.
export function CategoriesTab({
  period,
  search,
  label,
}: {
  period: ReportPeriod;
  search: ReportsSearch;
  // The words of the period, for the chart's series.
  label: string;
}) {
  const t = useT();
  const api = useApi();
  const [tag] = useAppLocale();
  const fmt = useMoneyFormat();
  const scale = useScale();
  const reportLink = useReportLink();
  const follow = useAppLink();
  const cls = search.class ?? "expense";
  const compare = search.compare === true;
  const before = previousPeriod(period);
  const problem = periodProblem(period.from, period.to);
  const base = useQuery(settingsQuery(api)).data?.base_currency;
  const accounts = useQuery(accountsQuery(api));
  const entries = useCategoryEntries(accounts.data);
  const current = useQuery({
    ...categoryTotalsQuery(api, period.from, period.to, cls),
    enabled: problem === undefined,
  });
  const previous = useQuery({
    ...categoryTotalsQuery(api, before.from, before.to, cls),
    enabled: problem === undefined && compare,
  });
  const level = useMemo(
    () =>
      categoryRows(
        entries,
        current.data,
        compare ? previous.data : undefined,
        cls,
        search.parent,
      ),
    [entries, current.data, previous.data, compare, cls, search.parent],
  );
  const currency = base ?? "";
  const digits = base === undefined || scale === null ? 0 : scale(base);
  const money = (amount: number) => fmt.money({ amount, currency }, digits);
  const none = t("report.none");
  const pending =
    problem === undefined &&
    (base === undefined ||
      scale === null ||
      accounts.isPending ||
      current.isPending ||
      (compare && previous.isPending));
  const error =
    accounts.error ?? current.error ?? (compare ? previous.error : null);
  const title = t("report.categories.title");
  const open =
    search.parent === undefined
      ? undefined
      : entries.find((e) => e.id === search.parent);
  const trail: { id: string; name: string }[] = [];
  let node = open;
  while (node !== undefined) {
    trail.unshift({ id: node.id, name: node.name });
    const parentId = node.parentId;
    node =
      parentId === undefined
        ? undefined
        : entries.find((e) => e.id === parentId);
  }
  const transactions = (row: CategoryRow) => {
    const query = new URLSearchParams({
      account_id: row.id,
      from: period.from,
      to: period.to,
    }).toString();
    return (
      <Link
        variant="neutral"
        underline="hover"
        href={`/transactions?${query}`}
        onClick={follow({
          to: "/transactions",
          search: { account_id: row.id, from: period.from, to: period.to },
        })}
      >
        {t("report.categories.transactions")}
      </Link>
    );
  };
  const columns = compare ? 7 : 4;
  const diff = (c: number | undefined, bp: number | undefined) => (
    <>
      <TableCell numeric>
        {c === undefined ? none : fmt.signed({ amount: c, currency }, digits)}
      </TableCell>
      <TableCell numeric>
        {bp === undefined ? none : formatSignedBasisPoints(bp, tag)}
      </TableCell>
    </>
  );
  const row = (r: CategoryRow, isDirect: boolean) => (
    <TableRow
      key={isDirect ? `${r.id}-direct` : r.id}
      value={isDirect ? `${r.id}-direct` : r.id}
    >
      <TableRowHeader>
        {isDirect ? (
          t("report.categories.directOf", { name: r.name })
        ) : r.hasChildren ? (
          <Link
            variant="neutral"
            underline="hover"
            {...reportLink({ ...search, parent: r.id })}
          >
            {r.name}
          </Link>
        ) : (
          r.name
        )}
      </TableRowHeader>
      <TableCell numeric>{money(r.subtree)}</TableCell>
      <TableCell numeric>{money(r.own)}</TableCell>
      {compare && (
        <>
          <TableCell numeric>{money(r.previous ?? 0)}</TableCell>
          {diff(r.change, r.changeBP)}
        </>
      )}
      <TableCell>{isDirect ? null : transactions(r)}</TableCell>
    </TableRow>
  );
  const shown = level.rows.slice(0, chartRows);
  const series: ChartSeries[] = [
    { id: "current", kind: "bar", field: "current", label, format: money },
    ...(compare
      ? [
          {
            id: "previous",
            kind: "bar" as const,
            field: "previous",
            label: t("report.compare.before"),
            tone: "neutral" as const,
            format: money,
          },
        ]
      : []),
  ];
  const data = shown.map((r) => ({
    name: r.name,
    current: r.subtree,
    previous: r.previous ?? 0,
  }));
  if (problem !== undefined)
    return (
      <InlineMessage tone="danger">
        {t(`report.period.${problem}`)}
      </InlineMessage>
    );
  if (error !== null)
    return (
      <QueryError
        error={error}
        onRetry={() => {
          void current.refetch();
          if (compare) void previous.refetch();
          void accounts.refetch();
        }}
      />
    );
  return (
    <Stack gap={4}>
      {open !== undefined && (
        <Breadcrumb aria-label={t("report.categories.trail")}>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink {...reportLink({ ...search, parent: undefined })}>
                {t("report.categories.all")}
              </BreadcrumbLink>
            </BreadcrumbItem>
            {trail.map((node, i) => (
              <BreadcrumbItem key={node.id}>
                {i === trail.length - 1 ? (
                  <BreadcrumbPage>{node.name}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink
                    {...reportLink({ ...search, parent: node.id })}
                  >
                    {node.name}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      )}
      {!pending && level.rows.length === 0 && level.direct === undefined ? (
        <ResultState status="empty" reach="section">
          <ResultStateContent>
            <ResultStateTitle>{t("report.categories.empty")}</ResultStateTitle>
          </ResultStateContent>
        </ResultState>
      ) : (
        <>
          {!pending && (
            <Chart
              variant="card"
              size="sm"
              orientation="horizontal"
              title={
                level.rows.length > chartRows
                  ? t("report.categories.chartTop", { count: chartRows })
                  : t("report.categories.chart")
              }
              data={data}
              series={series}
              x={{ field: "name" }}
              y={{ format: money }}
              trigger="item"
              toolbar="none"
            />
          )}
          <Table columns={columns} variant="framed">
            <TableContent>
              <TableCaption>{title}</TableCaption>
              <TableHead>
                <TableRow>
                  <TableColumnHeader>
                    {t("report.categories.category")}
                  </TableColumnHeader>
                  <TableColumnHeader numeric>
                    {t("report.categories.subtree")}
                  </TableColumnHeader>
                  <TableColumnHeader numeric>
                    {t("report.categories.direct")}
                  </TableColumnHeader>
                  {compare && (
                    <>
                      <TableColumnHeader numeric>
                        {t("report.compare.before")}
                      </TableColumnHeader>
                      <TableColumnHeader numeric>
                        {t("report.compare.difference")}
                      </TableColumnHeader>
                      <TableColumnHeader numeric>
                        {t("report.compare.differencePercent")}
                      </TableColumnHeader>
                    </>
                  )}
                  <TableColumnHeader>
                    {t("report.categories.records")}
                  </TableColumnHeader>
                </TableRow>
              </TableHead>
              {pending ? (
                <TableLoader skeletonRows={4} />
              ) : (
                <>
                  <TableBody>
                    {level.rows.map((r) => row(r, false))}
                    {level.direct !== undefined && row(level.direct, true)}
                  </TableBody>
                  <TableSummary>
                    <TableRow>
                      <TableRowHeader>{t("report.total")}</TableRowHeader>
                      <TableCell numeric>{money(level.total)}</TableCell>
                      <TableCell />
                      {compare && (
                        <>
                          <TableCell numeric>
                            {money(level.previousTotal ?? 0)}
                          </TableCell>
                          {diff(level.change, level.changeBP)}
                        </>
                      )}
                      <TableCell />
                    </TableRow>
                  </TableSummary>
                </>
              )}
            </TableContent>
          </Table>
        </>
      )}
    </Stack>
  );
}
