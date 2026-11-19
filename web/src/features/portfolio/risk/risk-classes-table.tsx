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

interface RiskClassesTableProps {
  report: RiskReport;
}

const columns = 5;

// A figure the report leaves absent (RK7, RK10).
const absent = "—";

// RK10: a class whose share of the risk exceeds its weight swings more than its size.
export function RiskClassesTable({ report }: RiskClassesTableProps) {
  const t = useT();
  const [tag] = useAppLocale();

  const percent = (bp: number | undefined) =>
    bp === undefined ? absent : formatBasisPoints(bp, tag);

  return (
    <Table columns={columns} variant="framed">
      <TableContent aria-label={t("portfolio.risk.classes")}>
        <TableHead>
          <TableRow>
            <TableColumnHeader>{t("portfolio.risk.class")}</TableColumnHeader>
            <TableColumnHeader numeric>
              {t("portfolio.risk.weight")}
            </TableColumnHeader>
            <TableColumnHeader numeric>
              {t("portfolio.risk.share")}
            </TableColumnHeader>
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
              <TableCell numeric>{percent(c.weight_bp)}</TableCell>
              <TableCell numeric>{percent(c.risk_share_bp)}</TableCell>
              <TableCell numeric>{percent(c.volatility_bp)}</TableCell>
              <TableCell numeric>{percent(c.max_drawdown_bp)}</TableCell>
            </TableRow>
          ))}
        </TableBody>

        <TableSummary>
          <TableRow>
            <TableRowHeader>{classLabel(t, portfolioKey)}</TableRowHeader>
            <TableCell numeric>{percent(10000)}</TableCell>
            <TableCell numeric>{percent(10000)}</TableCell>
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
