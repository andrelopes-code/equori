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
import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { flowsByMonth } from "@/features/portfolio/return/flows-by-month";
import { useScale } from "@/features/setup";
import { formatReferenceMonth } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

import styles from "@/features/portfolio/return/flows-by-month-table.module.css";
import layer from "@/ui/dialogs/detail-dialog.module.css";

type ReturnFlow = components["schemas"]["ReturnFlow"];

interface FlowsByMonthTableProps {
  flows: readonly ReturnFlow[];
  currency: string;
}

// L3: the deposits and withdrawals of the period by month, newest first. A period with no flow
// states it in one sentence in place of the table (CA2).
export function FlowsByMonthTable({ flows, currency }: FlowsByMonthTableProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const fmt = useMoneyFormat();
  const scale = useScale();

  const months = flowsByMonth(flows, currency);
  const none = t("report.none");

  // A zero is not drawn along a column (CA2).
  const money = (amount: number) =>
    amount === 0
      ? none
      : fmt.money({ amount, currency }, scale?.(currency) ?? 0);

  if (flows.length === 0) {
    return (
      <Text size="sm" tone="muted">
        {t("portfolio.return.noFlows")}
      </Text>
    );
  }

  return (
    <Table columns={3} variant="framed" stickyHeader className={layer.table}>
      <TableContent scrollProps={{ className: styles.scroll }}>
        <TableCaption>{t("holdings.method.flowsByMonth")}</TableCaption>
        <TableHead>
          <TableRow>
            <TableColumnHeader>{t("report.month")}</TableColumnHeader>
            <TableColumnHeader numeric>
              {t("holdings.method.deposits")}
            </TableColumnHeader>
            <TableColumnHeader numeric>
              {t("holdings.method.withdrawals")}
            </TableColumnHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {months.map((row) => (
            <TableRow key={row.month}>
              <TableRowHeader>
                {formatReferenceMonth(row.month, tag)}
              </TableRowHeader>
              <TableCell numeric>{money(row.deposits)}</TableCell>
              <TableCell numeric>{money(row.withdrawals)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </TableContent>
    </Table>
  );
}
