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

import type { components } from "@/api/schema.gen";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

type SchedulePause = components["schemas"]["SchedulePause"];

interface PausesTableProps {
  pauses: SchedulePause[];
}

// The pauses of a schedule, each from its first to its last suppressed date.
export function PausesTable({ pauses }: PausesTableProps) {
  const t = useT();
  const [locale] = useAppLocale();

  return (
    <Table columns={2} variant="framed">
      <TableContent>
        <TableCaption>{t("schedule.pauses")}</TableCaption>
        <TableHead>
          <TableRow>
            <TableColumnHeader>{t("schedule.pauseFrom")}</TableColumnHeader>
            <TableColumnHeader>{t("schedule.pauseTo")}</TableColumnHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {pauses.length === 0 && (
            <TableEmpty>{t("schedule.noPauses")}</TableEmpty>
          )}
          {pauses.map((p) => (
            <TableRow key={p.from} value={p.from}>
              <TableRowHeader>{formatDate(p.from, locale)}</TableRowHeader>
              <TableCell>{formatDate(p.to, locale)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </TableContent>
    </Table>
  );
}
