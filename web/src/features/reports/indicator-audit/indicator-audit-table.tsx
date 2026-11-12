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

import type { Indicators, RatioKey } from "@/features/overview";
import { activeFrom } from "@/features/reports/model/indicator-series";
import { useIndicatorFormat } from "@/features/reports/model/use-indicator-format";
import type { MessageKey } from "@/i18n/catalog.en";
import { formatReferenceMonth } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

import styles from "@/features/reports/indicator-audit/indicator-audit-table.module.css";

export interface IndicatorAuditTableProps {
  report: Indicators;
}

type Month = Indicators["months"][number];

const columns: readonly MessageKey[] = [
  "report.month",
  "report.indicators.income",
  "report.indicators.expense",
  "report.indicators.savings",
  "report.indicators.trailing",
  "overview.indicators.reserve",
  "report.indicators.committed",
  "report.indicators.debt",
  "report.indicators.reserve.liquid",
  "report.indicators.reserve.debts",
];

const ratios: readonly RatioKey[] = [
  "savings_rate",
  "trailing_savings_rate",
  "liquidity",
  "committed_share",
  "debt_service_share",
];

// The payload as it came, one row per month. A month before the first record is a gap; a ratio
// without a value writes its reason in a word.
export function IndicatorAuditTable({ report }: IndicatorAuditTableProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const format = useIndicatorFormat(report.currency);

  if (format === null) return null;

  const from = activeFrom(report);
  const gap = t("report.none");
  const amount = (value: number, index: number) =>
    index < from ? gap : format.money(value);
  const ratio = (kind: RatioKey, month: Month, index: number) => {
    const { bp, reason } = month[kind];

    if (index < from) return gap;

    if (bp === undefined)
      return t(
        `report.indicators.audit.reason.${reason ?? "insufficient_history"}`,
      );

    return kind === "liquidity" ? format.ratio(kind, bp) : format.percent(bp);
  };

  return (
    <Table columns={columns.length} variant="framed" stickyHeader>
      <TableContent scrollProps={{ className: styles.scroll }}>
        <TableCaption>{t("report.indicators.audit.caption")}</TableCaption>

        <TableHead>
          <TableRow>
            {columns.map((key, i) => (
              <TableColumnHeader key={key} numeric={i > 0}>
                {t(key)}
              </TableColumnHeader>
            ))}
          </TableRow>
        </TableHead>

        <TableBody>
          {report.months.map((m, i) => (
            <TableRow key={m.month}>
              <TableRowHeader text="nowrap">
                {formatReferenceMonth(m.month, locale)}
              </TableRowHeader>
              <TableCell numeric>{amount(m.income.amount, i)}</TableCell>
              <TableCell numeric>{amount(m.expense.amount, i)}</TableCell>
              {ratios.map((kind) => (
                <TableCell key={kind} numeric>
                  {ratio(kind, m, i)}
                </TableCell>
              ))}
              <TableCell numeric>
                {amount(m.liquid_balance.amount, i)}
              </TableCell>
              <TableCell numeric>{amount(m.liabilities.amount, i)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </TableContent>
    </Table>
  );
}
