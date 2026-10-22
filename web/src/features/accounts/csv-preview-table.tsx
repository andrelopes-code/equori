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

import type { CsvPreview } from "@/features/accounts/csv-preview";
import { formatDate, formatMoney } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

// The first ten lines as the server will read them; a cell it cannot read says so in its place.
export function CsvPreviewTable({
  preview,
  currency,
  scale,
}: {
  preview: CsvPreview;
  currency: string;
  scale: number;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  return (
    <Table columns={3} variant="framed">
      <TableContent>
        <TableCaption>{t("importFile.preview")}</TableCaption>
        <TableHead>
          <TableRow>
            <TableColumnHeader>{t("scheduled.date")}</TableColumnHeader>
            <TableColumnHeader>{t("ledger.movement")}</TableColumnHeader>
            <TableColumnHeader numeric>{t("ledger.amount")}</TableColumnHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {preview.rows.length === 0 && (
            <TableEmpty>{t("importFile.noLines")}</TableEmpty>
          )}
          {preview.rows.map((row, i) => (
            // A preview line has no identity beyond its place in the file.
            <TableRow key={i}>
              <TableRowHeader>
                {row.date === undefined ? (
                  <Text size="sm" tone="danger">
                    {t("importFile.unreadable")}
                  </Text>
                ) : (
                  formatDate(row.date, locale)
                )}
              </TableRowHeader>
              <TableCell>{row.description}</TableCell>
              <TableCell numeric>
                {row.amount === undefined ? (
                  <Text size="sm" tone="danger">
                    {t("importFile.unreadable")}
                  </Text>
                ) : (
                  formatMoney({ amount: row.amount, currency }, scale, locale)
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </TableContent>
    </Table>
  );
}
