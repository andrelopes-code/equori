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
} from "@slotted/react/table";
import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { indexName } from "@/features/calculators";
import { useScale } from "@/features/setup";
import { formatBasisPoints, formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

type Money = components["schemas"]["Money"];
type ReturnReport = components["schemas"]["ReturnReport"];

interface ReturnFiguresProps {
  report: ReturnReport;
}

// The figures of a return: the annual rate, the values at both ends, the time-weighted return and
// its comparison with an index (amendment A208), then the external flows.
export function ReturnFigures({ report }: ReturnFiguresProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const fmt = useMoneyFormat();
  const scale = useScale();

  const {
    annual_bp: rate,
    opening,
    closing,
    flows,
    period_bp,
    benchmark,
  } = report;
  const money = (m: Money) => fmt.money(m, scale?.(m.currency) ?? 0);

  return (
    <Stack gap={3}>
      <div role="group" aria-label={t("portfolio.return.title")}>
        <Stack gap={1}>
          <Text size="2xl" weight="semibold">
            {formatBasisPoints(rate, tag)}
          </Text>
          <Text size="sm" tone="muted">
            {[t("portfolio.return.opening"), money(opening)].join(": ")}
          </Text>
          <Text size="sm" tone="muted">
            {[t("portfolio.return.closing"), money(closing)].join(": ")}
          </Text>
          {period_bp !== undefined && (
            <Text size="sm" tone="muted">
              {t("portfolio.return.period", {
                rate: formatBasisPoints(period_bp, tag),
              })}
            </Text>
          )}
          {benchmark?.percent_bp !== undefined && (
            <Text size="sm" tone="muted">
              {t("portfolio.return.percentOfIndex", {
                percent: formatBasisPoints(benchmark.percent_bp, tag),
                index: indexName(benchmark.index),
                from: formatDate(benchmark.from, tag),
                until: formatDate(benchmark.until, tag),
              })}
            </Text>
          )}
          {benchmark !== undefined && (
            <Text size="sm" tone="muted">
              {t("portfolio.return.indexGrowth", {
                index: indexName(benchmark.index),
                rate: formatBasisPoints(benchmark.index_bp, tag),
              })}
            </Text>
          )}
        </Stack>
      </div>

      {flows.length === 0 && (
        <Text size="sm" tone="muted">
          {t("portfolio.return.noFlows")}
        </Text>
      )}

      {flows.length > 0 && (
        <Table columns={2} variant="framed">
          <TableContent>
            <TableCaption>{t("portfolio.return.flows")}</TableCaption>
            <TableHead>
              <TableRow>
                <TableColumnHeader>
                  {t("portfolio.return.date")}
                </TableColumnHeader>
                <TableColumnHeader numeric>
                  {t("portfolio.return.amount")}
                </TableColumnHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {flows.map((flow, index) => (
                <TableRow key={`${flow.date}-${String(index)}`}>
                  <TableCell>{formatDate(flow.date, tag)}</TableCell>
                  <TableCell numeric>{money(flow.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </TableContent>
        </Table>
      )}
    </Stack>
  );
}
