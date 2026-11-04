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
} from "@slotted/react/table";

import type { netWorthRows } from "@/features/reports/net-worth-months";
import { formatReferenceMonth, formatSignedBasisPoints } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

interface NetWorthTableProps {
  rows: ReturnType<typeof netWorthRows>;
  pending: boolean;
  title: string;
  currency: string;
  digits: number;
}

// The month ends of the net worth tab, newest first, with the change from the month before.
export function NetWorthTable({
  rows,
  pending,
  title,
  currency,
  digits,
}: NetWorthTableProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const fmt = useMoneyFormat();

  const money = (amount: number) => fmt.money({ amount, currency }, digits);
  const label = (month: string) => formatReferenceMonth(month, tag);
  const none = t("report.none");

  return (
    <Table columns={6} variant="framed">
      <TableContent>
        <TableCaption>{title}</TableCaption>
        <TableHead>
          <TableRow>
            <TableColumnHeader>{t("report.month")}</TableColumnHeader>
            <TableColumnHeader numeric>
              {t("report.netWorth.assets")}
            </TableColumnHeader>
            <TableColumnHeader numeric>
              {t("report.netWorth.liabilities")}
            </TableColumnHeader>
            <TableColumnHeader numeric>
              {t("report.netWorth.net")}
            </TableColumnHeader>
            <TableColumnHeader numeric>{t("report.change")}</TableColumnHeader>
            <TableColumnHeader numeric>
              {t("report.changePercent")}
            </TableColumnHeader>
          </TableRow>
        </TableHead>
        {pending ? (
          <TableLoader skeletonRows={6} />
        ) : (
          <TableBody>
            {rows
              .slice()
              .reverse()
              .map((r) => (
                <TableRow key={r.month} value={r.month}>
                  <TableRowHeader>{label(r.month)}</TableRowHeader>
                  <TableCell numeric>
                    {r.assets === undefined ? none : money(r.assets)}
                  </TableCell>
                  <TableCell numeric>
                    {r.liabilities === undefined ? none : money(r.liabilities)}
                  </TableCell>
                  <TableCell numeric>
                    {r.net === undefined ? none : money(r.net)}
                  </TableCell>
                  <TableCell numeric>
                    {r.change === undefined
                      ? none
                      : fmt.signed({ amount: r.change, currency }, digits)}
                  </TableCell>
                  <TableCell numeric>
                    {r.changeBP === undefined
                      ? none
                      : formatSignedBasisPoints(r.changeBP, tag)}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        )}
      </TableContent>
    </Table>
  );
}
