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

import styles from "@/features/reports/entry-table.module.css";
import type { EntryRow } from "@/features/reports/net-worth-days";
import { formatDayMonth } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

interface EntryTableProps {
  rows: readonly EntryRow[];
  day: string | undefined;
  currency: string;
  digits: number;
}

// The income and expenses of the month or of the day picked, by their effect on net worth, the
// largest first; ruled, as the card around it is the frame (net worth days design, D4).
export function EntryTable({ rows, day, currency, digits }: EntryTableProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const fmt = useMoneyFormat();

  const caption =
    day === undefined
      ? t("report.netWorth.entries")
      : t("report.netWorth.entriesOfDay", { date: formatDayMonth(day, tag) });

  return (
    <Table columns={3} stickyHeader>
      <TableContent scrollProps={{ className: styles.scroll }}>
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
            <TableEmpty>{t("report.netWorth.noEntries")}</TableEmpty>
          )}
          {rows.map((row) => (
            <TableRow key={row.key} value={row.key}>
              <TableCell>{formatDayMonth(row.date, tag)}</TableCell>
              <TableRowHeader>
                {/* The category under the description keeps the amount in a half-width card. */}
                <Stack gap={0}>
                  <Text size="sm" weight="medium">
                    {row.description}
                  </Text>
                  <Text size="xs" tone="muted">
                    {row.category}
                  </Text>
                </Stack>
              </TableRowHeader>
              <TableCell numeric>
                <Text
                  size="sm"
                  weight="medium"
                  tone={row.amount > 0 ? "success" : "danger"}
                >
                  {fmt.signed({ amount: row.amount, currency }, digits)}
                </Text>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </TableContent>
    </Table>
  );
}
