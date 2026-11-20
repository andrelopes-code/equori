import { Inline } from "@slotted/react/inline";
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
import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { classLabel } from "@/features/portfolio/risk/class-label";
import { RiskShareBar } from "@/features/portfolio/risk/risk-share-bar";
import { formatBasisPoints } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

type RiskReport = components["schemas"]["RiskReport"];

interface RiskClassesTableProps {
  report: RiskReport;
}

const columns = 4;

// RK10: each class's share of the money beside its share of the variation, the class that varies
// the portfolio the most first; the bar draws the second against a mark at the first. A class
// priced by its rate says so on its row (RK11). The measures of each class are in the details.
export function RiskClassesTable({ report }: RiskClassesTableProps) {
  const t = useT();
  const [tag] = useAppLocale();

  const percent = (bp: number) => formatBasisPoints(bp, tag);
  const classes = [...report.classes].sort(
    (a, b) => (b.risk_share_bp ?? -1e9) - (a.risk_share_bp ?? -1e9),
  );

  return (
    <Table columns={columns} variant="ruled">
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
            <TableColumnHeader>{t("portfolio.risk.compare")}</TableColumnHeader>
          </TableRow>
        </TableHead>

        <TableBody>
          {classes.map((c) => (
            <TableRow key={c.key} value={c.key}>
              <TableRowHeader>
                <Inline gap={4} align="center">
                  <span>{classLabel(t, c.key)}</span>
                  {(c.accrual_bp ?? 0) > 0 && (
                    <Text size="sm" tone="muted">
                      {t("portfolio.risk.accrualHint", {
                        share: percent(c.accrual_bp ?? 0),
                      })}
                    </Text>
                  )}
                </Inline>
              </TableRowHeader>
              <TableCell numeric>{percent(c.weight_bp ?? 0)}</TableCell>
              <TableCell numeric>
                {shareText(c.risk_share_bp, t, percent)}
              </TableCell>
              <TableCell>
                {c.risk_share_bp !== undefined && (
                  <RiskShareBar
                    share={c.risk_share_bp}
                    weight={c.weight_bp ?? 0}
                    label={t("portfolio.risk.barLabel", {
                      share: percent(c.risk_share_bp),
                      weight: percent(c.weight_bp ?? 0),
                    })}
                  />
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </TableContent>
    </Table>
  );
}

// A negative share reduces the swing: it reads as such rather than as a minus sign.
function shareText(
  share: number | undefined,
  t: ReturnType<typeof useT>,
  percent: (bp: number) => string,
): string {
  if (share === undefined) return t("portfolio.risk.unmeasured");
  if (share < 0) return t("portfolio.risk.reduces", { value: percent(-share) });

  return percent(share);
}
