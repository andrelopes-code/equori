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
  TableRowHeader,
  TableSummary,
} from "@slotted/react/table";
import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import styles from "@/features/accounts/balance-sheet.module.css";
import { BalanceGroupRow } from "@/features/accounts/balance-group-row";
import type { SheetRow } from "@/features/accounts/balance-sheet";
import { useMeasuredTops } from "@/features/portfolio";
import { useT } from "@/i18n/i18n-provider";
import { MoneyFigure } from "@/ui/money-figure";

type Institution = components["schemas"]["Institution"];
type Money = components["schemas"]["Money"];

// A group of the balance sheet holds a household's accounts of one kind: a bounded set, so a
// table (LP-14) with the group's total in its summary row (RP-07).
export function BalanceGroupTable({
  label,
  rows,
  total,
  excluded,
  date,
  institutions,
  scale,
}: {
  label: string;
  rows: SheetRow[];
  total: Money;
  excluded: number;
  date: string;
  institutions: Map<string, Institution>;
  scale: (code: string) => number;
}) {
  const t = useT();
  const measured = useMeasuredTops();

  const yieldColumn = rows.some((row) => measured.has(row.account.id));
  return (
    <Stack gap={2}>
      <Table columns={yieldColumn ? 5 : 4} variant="framed">
        <TableContent>
          <TableCaption>{label}</TableCaption>
          <TableHead>
            <TableRow>
              <TableColumnHeader>{t("balanceSheet.account")}</TableColumnHeader>
              <TableColumnHeader className={styles.fit}>
                {t("balanceSheet.kind")}
              </TableColumnHeader>
              <TableColumnHeader className={styles.fit}>
                {t("balanceSheet.status")}
              </TableColumnHeader>
              <TableColumnHeader numeric className={styles.fit}>
                {t("balanceSheet.balance")}
              </TableColumnHeader>
              {yieldColumn && (
                <TableColumnHeader numeric className={styles.fit}>
                  {t("balanceSheet.yield")}
                </TableColumnHeader>
              )}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <BalanceGroupRow
                key={row.account.id}
                row={row}
                date={date}
                institutions={institutions}
                scale={scale}
                yieldColumn={yieldColumn}
              />
            ))}
          </TableBody>
          <TableSummary>
            <TableRow>
              <TableRowHeader colSpan={3}>
                {t("balanceSheet.groupTotal")}
              </TableRowHeader>
              <TableCell numeric>
                <Text size="sm" weight="semibold">
                  <MoneyFigure
                    amount={total.amount}
                    currency={total.currency}
                    scale={scale(total.currency)}
                  />
                </Text>
              </TableCell>
              {yieldColumn && <TableCell />}
            </TableRow>
          </TableSummary>
        </TableContent>
      </Table>
      {excluded > 0 && (
        <Text size="sm" tone="muted">
          {t("balanceSheet.excluded", { count: excluded })}
        </Text>
      )}
    </Stack>
  );
}
