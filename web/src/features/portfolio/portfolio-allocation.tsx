import { Chart } from "@slotted/react/chart";
import type { ChartSeries } from "@slotted/core/chart";
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
import { Text } from "@slotted/react/typography";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { allocationQuery } from "@/features/portfolio/api";
import { allocationBys } from "@/features/portfolio/portfolio-search";
import type { AllocationBy } from "@/features/portfolio/portfolio-search";
import { PortfolioProblem } from "@/features/portfolio/portfolio-problem";
import { catalogLabel, useScale } from "@/features/setup";
import { formatBasisPoints } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import type { TFunction } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

type Group = components["schemas"]["AllocationGroup"];

// The key of a group is a type, a currency code or an institution name; the empty key is the
// accounts without an institution. A type the catalog does not name reads as its code.
function keyLabel(t: TFunction, by: AllocationBy, key: string): string {
  if (by === "type") return catalogLabel(t, `instruments.type.${key}`, key);
  if (by === "institution" && key === "")
    return t("portfolio.allocation.noInstitution");
  return key;
}

// The asset accounts at the valuation date grouped by type, currency or institution, as a
// proportional chart and the table that holds the same figures.
export function PortfolioAllocation({
  date,
  by,
  valueIn,
  onBy,
}: {
  date: string;
  by: AllocationBy;
  valueIn: string | undefined;
  onBy: (by: AllocationBy) => void;
}) {
  const t = useT();
  const [tag] = useAppLocale();
  const api = useApi();
  const fmt = useMoneyFormat();
  const scale = useScale();
  const allocation = useQuery(allocationQuery(api, date, by, valueIn));
  const digits = (code: string) => scale?.(code) ?? 0;
  const money = (m: components["schemas"]["Money"]) =>
    fmt.money(m, digits(m.currency));
  const groups: readonly Group[] = useMemo(
    () => allocation.data?.groups ?? [],
    [allocation.data],
  );
  const title = t(`portfolio.allocation.title.${by}`);
  const pending = allocation.isPending || scale === null;
  const series: ChartSeries[] = [
    {
      id: "value",
      kind: "pie",
      field: "value",
      label: t("portfolio.allocation.value"),
      format: (value: number) =>
        money({
          amount: value,
          currency: allocation.data?.total.currency ?? "",
        }),
    },
  ];
  const data = groups.map((g) => ({
    name: keyLabel(t, by, g.key),
    value: g.value.amount,
  }));
  return (
    <Stack gap={3}>
      <SegmentedControl
        size="sm"
        aria-label={t("portfolio.by")}
        value={by}
        onValueChange={(value) => {
          const next = allocationBys.find((b) => b === value);
          if (next !== undefined) onBy(next);
        }}
      >
        {allocationBys.map((b) => (
          <Segment key={b} value={b}>
            {t(`portfolio.by.${b}`)}
          </Segment>
        ))}
      </SegmentedControl>
      {valueIn !== undefined && (
        <Text size="sm" tone="muted">
          {t("portfolio.valuedIn", { currency: valueIn })}
        </Text>
      )}
      {allocation.isError ? (
        <PortfolioProblem
          error={allocation.error}
          currency={valueIn}
          onRetry={() => void allocation.refetch()}
        />
      ) : !pending && groups.length === 0 ? (
        <ResultState status="empty" reach="section">
          <ResultStateContent>
            <ResultStateTitle>
              {t("portfolio.allocation.empty")}
            </ResultStateTitle>
          </ResultStateContent>
        </ResultState>
      ) : (
        <>
          {!pending && (
            <Chart
              variant="card"
              size="sm"
              title={title}
              data={data}
              series={series}
              x={{ field: "name" }}
              trigger="item"
              toolbar="none"
            />
          )}
          <Table columns={3} variant="framed">
            <TableContent>
              <TableCaption>{title}</TableCaption>
              <TableHead>
                <TableRow>
                  <TableColumnHeader>
                    {t("portfolio.allocation.group")}
                  </TableColumnHeader>
                  <TableColumnHeader numeric>
                    {t("portfolio.allocation.value")}
                  </TableColumnHeader>
                  <TableColumnHeader numeric>
                    {t("portfolio.share")}
                  </TableColumnHeader>
                </TableRow>
              </TableHead>
              {pending ? (
                <TableLoader skeletonRows={3} />
              ) : (
                <>
                  <TableBody>
                    {groups.map((g) => (
                      <TableRow key={g.key} value={g.key}>
                        <TableRowHeader>
                          {keyLabel(t, by, g.key)}
                        </TableRowHeader>
                        <TableCell numeric>{money(g.value)}</TableCell>
                        <TableCell numeric>
                          {formatBasisPoints(g.share_bp, tag)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableSummary>
                    <TableRow>
                      <TableRowHeader>
                        {t("portfolio.allocation.total")}
                      </TableRowHeader>
                      <TableCell numeric>
                        {money(allocation.data.total)}
                      </TableCell>
                      <TableCell numeric>
                        {formatBasisPoints(10000, tag)}
                      </TableCell>
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
