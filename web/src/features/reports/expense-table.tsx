import { Stack } from "@slotted/react/stack";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableColumnHeader,
  TableContent,
  TableEmpty,
  TableHead,
  TableRow,
  TableRowHeader,
} from "@slotted/react/table";
import { Text } from "@slotted/react/typography";

import styles from "@/features/reports/expense-table.module.css";
import type { ExpenseRow } from "@/features/reports/net-worth-days";
import { formatDayMonth } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

interface ExpenseTableProps {
  rows: readonly ExpenseRow[];
  day: string | undefined;
  currency: string;
  digits: number;
}

// The expenses of the month or of the day picked, the largest first (net worth days design, D4).
export function ExpenseTable({
  rows,
  day,
  currency,
  digits,
}: ExpenseTableProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const fmt = useMoneyFormat();

  const caption =
    day === undefined
      ? t("report.netWorth.expenses")
      : t("report.netWorth.expensesOfDay", { date: formatDayMonth(day, tag) });

  return (
    <div className={styles.scroll}>
      <Table columns={3} variant="framed" stickyHeader>
        <TableContent>
          <TableCaption>{caption}</TableCaption>
          <TableHead>
            <TableRow>
              <TableColumnHeader>{t("report.netWorth.date")}</TableColumnHeader>
              <TableColumnHeader>
                {t("report.netWorth.description")}
              </TableColumnHeader>
              <TableColumnHeader numeric>
                {t("report.netWorth.amount")}
              </TableColumnHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 && (
              <TableEmpty>{t("report.netWorth.noExpenses")}</TableEmpty>
            )}
            {rows.map((row) => (
              <TableRow key={row.key} value={row.key}>
                <TableCell>{formatDayMonth(row.date, tag)}</TableCell>
                <TableRowHeader>
                  {/* The category under the description keeps the amount in a half-width card. */}
                  <Stack gap={0}>
                    {row.description}
                    <Text size="xs" tone="muted">
                      {row.category}
                    </Text>
                  </Stack>
                </TableRowHeader>
                <TableCell numeric>
                  {fmt.money({ amount: row.amount, currency }, digits)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </TableContent>
      </Table>
    </div>
  );
}
