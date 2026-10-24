import type { ChartSeries } from "@slotted/core/chart";
import { Chart } from "@slotted/react/chart";
import { Inline } from "@slotted/react/inline";
import { InlineMessage } from "@slotted/react/inline-message";
import {
  ResultState,
  ResultStateContent,
  ResultStateTitle,
} from "@slotted/react/result-state";
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
  TableSummary,
} from "@slotted/react/table";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useApi } from "@/api/api-context";
import { accountsQuery, shapeOf } from "@/features/accounts";
import { flowsQuery } from "@/features/cards";
import { periodProblem } from "@/features/portfolio";
import { flowRows, flowTotals } from "@/features/reports/flow-rows";
import type { FlowBy, FlowRow } from "@/features/reports/flow-rows";
import { changeBP } from "@/features/reports/report-change";
import { previousPeriod } from "@/features/reports/report-period";
import type { ReportPeriod } from "@/features/reports/report-period";
import type {
  ReportsPatch,
  ReportsSearch,
} from "@/features/reports/reports-search";
import { useScale } from "@/features/setup";
import {
  formatDate,
  formatDayMonth,
  formatReferenceMonth,
  formatSignedBasisPoints,
} from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { ChoiceSelect } from "@/ui/choice-select";
import { QueryError } from "@/ui/query-error";

const groups = {
  square: "accounts",
  card: "cards",
  circle: "reserves",
} as const;

// The inflow and outflow an account booked in a period, per day or added per month, with the
// result of each row. A comparison sets the totals of the period against the period before.
export function FlowsTab({
  period,
  search,
  onChange,
}: {
  period: ReportPeriod;
  search: ReportsSearch;
  onChange: (patch: ReportsPatch) => void;
}) {
  const t = useT();
  const api = useApi();
  const [tag] = useAppLocale();
  const fmt = useMoneyFormat();
  const scale = useScale();
  const by: FlowBy = search.by ?? "day";
  const compare = search.compare === true;
  const before = previousPeriod(period);
  const problem = periodProblem(period.from, period.to);
  const accounts = useQuery(accountsQuery(api));
  const offered = useMemo(() => {
    const all = accounts.data ?? [];
    const parents = new Set(all.map((a) => a.parent_id));
    const order = ["accounts", "cards", "reserves"] as const;
    const collator = new Intl.Collator(tag, { sensitivity: "base" });
    return all
      .filter(
        (a) =>
          (a.class === "asset" || a.class === "liability") &&
          !parents.has(a.id) &&
          a.system_role === undefined &&
          (a.closed_on === undefined || a.id === search.account),
      )
      .map((a) => ({ account: a, group: groups[shapeOf(a.kind)] }))
      .sort(
        (x, y) =>
          order.indexOf(x.group) - order.indexOf(y.group) ||
          collator.compare(x.account.name, y.account.name),
      );
  }, [accounts.data, tag, search.account]);
  const account =
    offered.find((o) => o.account.id === search.account)?.account ??
    offered[0]?.account;
  const accountID = account?.id;
  const current = useQuery({
    ...flowsQuery(api, accountID ?? "", period.from, period.to),
    enabled: problem === undefined && accountID !== undefined,
  });
  const previous = useQuery({
    ...flowsQuery(api, accountID ?? "", before.from, before.to),
    enabled: problem === undefined && accountID !== undefined && compare,
  });
  const rows = useMemo(
    () => flowRows(current.data ?? [], by),
    [current.data, by],
  );
  const totals = flowTotals(rows);
  const before$ = useMemo(
    () => flowTotals(flowRows(previous.data ?? [], by)),
    [previous.data, by],
  );
  const currency = account?.currency ?? "";
  const digits = scale === null || account === undefined ? 0 : scale(currency);
  const money = (amount: number) => fmt.money({ amount, currency }, digits);
  const signed = (amount: number) => fmt.signed({ amount, currency }, digits);
  const none = t("report.none");
  const label = (key: string) =>
    by === "month" ? formatReferenceMonth(key, tag) : formatDate(key, tag);
  const chartLabel = (key: string) =>
    by === "month" ? formatReferenceMonth(key, tag) : formatDayMonth(key, tag);
  const pending =
    problem === undefined &&
    (accounts.isPending ||
      scale === null ||
      (accountID !== undefined &&
        (current.isPending || (compare && previous.isPending))));
  const error =
    accounts.error ?? current.error ?? (compare ? previous.error : null);
  const title = t("report.flows.title");
  const series: ChartSeries[] = [
    {
      id: "inflow",
      kind: "bar",
      field: "inflow",
      label: t("report.flows.inflow"),
      format: money,
    },
    {
      id: "outflow",
      kind: "bar",
      field: "outflow",
      label: t("report.flows.outflow"),
      tone: "neutral",
      format: money,
    },
    {
      id: "result",
      kind: "line",
      field: "result",
      label: t("report.flows.result"),
      format: money,
    },
  ];
  const data = rows.map((r) => ({
    label: chartLabel(r.key),
    inflow: r.inflow,
    outflow: r.outflow,
    result: r.result,
  }));
  const metrics = [
    ["inflow", t("report.flows.inflow")],
    ["outflow", t("report.flows.outflow")],
    ["result", t("report.flows.result")],
  ] as const;
  const controls = (
    <Inline gap={3} wrap="wrap">
      <ChoiceSelect
        label={t("report.flows.account")}
        choices={offered.map((o) => ({
          value: o.account.id,
          label: o.account.name,
          group: t(`accountChoice.group.${o.group}`),
        }))}
        multiple={false}
        value={accountID ?? null}
        onChange={(next) => {
          if (typeof next === "string")
            onChange({
              account: next === offered[0]?.account.id ? undefined : next,
            });
        }}
      />
      <SegmentedControl
        size="sm"
        aria-label={t("report.flows.by")}
        value={by}
        onValueChange={(value) => {
          onChange({ by: value === "month" ? "month" : undefined });
        }}
      >
        <Segment value="day">{t("report.flows.byDay")}</Segment>
        <Segment value="month">{t("report.flows.byMonth")}</Segment>
      </SegmentedControl>
    </Inline>
  );
  let body;
  if (problem !== undefined)
    body = (
      <InlineMessage tone="danger">
        {t(`report.period.${problem}`)}
      </InlineMessage>
    );
  else if (error !== null)
    body = (
      <QueryError
        error={error}
        onRetry={() => {
          void accounts.refetch();
          if (accountID !== undefined) void current.refetch();
          if (compare && accountID !== undefined) void previous.refetch();
        }}
      />
    );
  else if (!pending && accountID === undefined)
    body = (
      <ResultState status="empty" reach="section">
        <ResultStateContent>
          <ResultStateTitle>{t("report.flows.noAccount")}</ResultStateTitle>
        </ResultStateContent>
      </ResultState>
    );
  else
    body = (
      <>
        {!pending && rows.length > 0 && (
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
        <Table columns={4} variant="framed">
          <TableContent>
            <TableCaption>{title}</TableCaption>
            <TableHead>
              <TableRow>
                <TableColumnHeader>
                  {t(by === "month" ? "report.month" : "report.flows.date")}
                </TableColumnHeader>
                <TableColumnHeader numeric>
                  {t("report.flows.inflow")}
                </TableColumnHeader>
                <TableColumnHeader numeric>
                  {t("report.flows.outflow")}
                </TableColumnHeader>
                <TableColumnHeader numeric>
                  {t("report.flows.result")}
                </TableColumnHeader>
              </TableRow>
            </TableHead>
            {pending ? (
              <TableLoader skeletonRows={4} />
            ) : (
              <>
                <TableBody>
                  {rows.map((r: FlowRow) => (
                    <TableRow key={r.key} value={r.key}>
                      <TableRowHeader>{label(r.key)}</TableRowHeader>
                      <TableCell numeric>{money(r.inflow)}</TableCell>
                      <TableCell numeric>{money(r.outflow)}</TableCell>
                      <TableCell numeric>{signed(r.result)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableSummary>
                  <TableRow>
                    <TableRowHeader>{t("report.total")}</TableRowHeader>
                    <TableCell numeric>{money(totals.inflow)}</TableCell>
                    <TableCell numeric>{money(totals.outflow)}</TableCell>
                    <TableCell numeric>{signed(totals.result)}</TableCell>
                  </TableRow>
                </TableSummary>
              </>
            )}
          </TableContent>
        </Table>
        {compare && !pending && (
          <Table columns={5} variant="framed">
            <TableContent>
              <TableCaption>{t("report.flows.comparison")}</TableCaption>
              <TableHead>
                <TableRow>
                  <TableColumnHeader />
                  <TableColumnHeader numeric>
                    {t("report.total")}
                  </TableColumnHeader>
                  <TableColumnHeader numeric>
                    {t("report.compare.before")}
                  </TableColumnHeader>
                  <TableColumnHeader numeric>
                    {t("report.compare.difference")}
                  </TableColumnHeader>
                  <TableColumnHeader numeric>
                    {t("report.compare.differencePercent")}
                  </TableColumnHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {metrics.map(([key, name]) => {
                  const diff = totals[key] - before$[key];
                  const bp = changeBP(diff, before$[key]);
                  return (
                    <TableRow key={key} value={key}>
                      <TableRowHeader>{name}</TableRowHeader>
                      <TableCell numeric>
                        {signedOrPlain(key, totals[key])}
                      </TableCell>
                      <TableCell numeric>
                        {signedOrPlain(key, before$[key])}
                      </TableCell>
                      <TableCell numeric>{signed(diff)}</TableCell>
                      <TableCell numeric>
                        {bp === undefined
                          ? none
                          : formatSignedBasisPoints(bp, tag)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </TableContent>
          </Table>
        )}
      </>
    );
  function signedOrPlain(key: "inflow" | "outflow" | "result", amount: number) {
    return key === "result" ? signed(amount) : money(amount);
  }
  return (
    <Stack gap={4}>
      {controls}
      {body}
    </Stack>
  );
}
