import {
  Table,
  TableBody,
  TableCell,
  TableColumnHeader,
  TableContent,
  TableHead,
  TableRow,
  TableRowHeader,
  TableSummary,
} from "@slotted/react/table";

import type { components } from "@/api/schema.gen";
import { classLabel } from "@/features/portfolio/risk/class-label";
import { portfolioKey } from "@/features/portfolio/risk/risk-figures";
import { formatBasisPoints } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

type RiskReport = components["schemas"]["RiskReport"];

interface RiskMeasuresTableProps {
  report: RiskReport;
}

const columns = 3;

// RK7, RK8: the typical yearly variation and the deepest fall of each class and of the portfolio,
// in the order of the report; a figure the report lacks reads "not measured".
export function RiskMeasuresTable({ report }: RiskMeasuresTableProps) {
  const t = useT();
  const [tag] = useAppLocale();

  const percent = (bp: number | undefined) =>
    bp === undefined
      ? t("portfolio.risk.unmeasured")
      : formatBasisPoints(bp, tag);

  return (
    <Table columns={columns} variant="ruled">
      <TableContent aria-label={t("portfolio.risk.measures")}>
        <TableHead>
          <TableRow>
            <TableColumnHeader>{t("portfolio.risk.class")}</TableColumnHeader>
            <TableColumnHeader numeric>
              {t("portfolio.risk.volatilityShort")}
            </TableColumnHeader>
            <TableColumnHeader numeric>
              {t("portfolio.risk.maxDrawdown")}
            </TableColumnHeader>
          </TableRow>
        </TableHead>

        <TableBody>
          {report.classes.map((c) => (
            <TableRow key={c.key} value={c.key}>
              <TableRowHeader>{classLabel(t, c.key)}</TableRowHeader>
              <TableCell numeric>{percent(c.volatility_bp)}</TableCell>
              <TableCell numeric>{percent(c.max_drawdown_bp)}</TableCell>
            </TableRow>
          ))}
        </TableBody>

        <TableSummary>
          <TableRow>
            <TableRowHeader>{classLabel(t, portfolioKey)}</TableRowHeader>
            <TableCell numeric>
              {percent(report.portfolio.volatility_bp)}
            </TableCell>
            <TableCell numeric>
              {percent(report.portfolio.max_drawdown_bp)}
            </TableCell>
          </TableRow>
        </TableSummary>
      </TableContent>
    </Table>
  );
}
