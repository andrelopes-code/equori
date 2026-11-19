import {
  Table,
  TableBody,
  TableCell,
  TableColumnHeader,
  TableContent,
  TableHead,
  TableRow,
  TableRowHeader,
} from "@slotted/react/table";

import type { components } from "@/api/schema.gen";
import { classLabel } from "@/features/portfolio/risk/class-label";
import { numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

type RiskReport = components["schemas"]["RiskReport"];

interface RiskCorrelationsTableProps {
  report: RiskReport;
}

const columns = 3;

// RK9: the correlation of each pair of classes over the last 36 months; absent pairs had fewer
// than 12 months in common. A report without a pair draws nothing.
export function RiskCorrelationsTable({ report }: RiskCorrelationsTableProps) {
  const t = useT();
  const [tag] = useAppLocale();

  if (report.correlations.length === 0) return null;

  const correlation = numberFormatter(tag, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const count = numberFormatter(tag, { maximumFractionDigits: 0 });

  return (
    <Table columns={columns} variant="framed">
      <TableContent aria-label={t("portfolio.risk.correlations")}>
        <TableHead>
          <TableRow>
            <TableColumnHeader>{t("portfolio.risk.pair")}</TableColumnHeader>
            <TableColumnHeader numeric>
              {t("portfolio.risk.correlation")}
            </TableColumnHeader>
            <TableColumnHeader numeric>
              {t("portfolio.risk.months")}
            </TableColumnHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {report.correlations.map((c) => (
            <TableRow key={`${c.a}-${c.b}`} value={`${c.a}-${c.b}`}>
              <TableRowHeader>
                {t("portfolio.risk.pairName", {
                  a: classLabel(t, c.a),
                  b: classLabel(t, c.b),
                })}
              </TableRowHeader>
              <TableCell numeric>
                {correlation.format(c.correlation_bp / 10000)}
              </TableCell>
              <TableCell numeric>{count.format(c.months)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </TableContent>
    </Table>
  );
}
