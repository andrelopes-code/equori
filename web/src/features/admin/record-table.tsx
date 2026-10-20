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
} from "@slotted/react/table";

import { cellText } from "@/features/admin/cell-text";
import type { CellContext } from "@/features/admin/cell-text";
import { useT } from "@/i18n/i18n-provider";

export type Row = Readonly<Record<string, unknown>>;

// Columns default to every key the rows hold, in the order they first appear.
export function columnsOf(rows: readonly Row[]): string[] {
  const keys = new Set<string>();
  for (const row of rows) for (const key of Object.keys(row)) keys.add(key);
  return [...keys];
}

export function RecordTable({
  caption,
  rows,
  cells,
  columns = columnsOf(rows),
}: {
  caption: string;
  rows: readonly Row[];
  cells: CellContext;
  columns?: readonly string[];
}) {
  const t = useT();
  return (
    <Table columns={Math.max(columns.length, 1)} variant="framed" striped>
      <TableContent>
        <TableCaption>{caption}</TableCaption>
        <TableHead>
          <TableRow>
            {columns.map((column) => (
              <TableColumnHeader key={column} text="nowrap">
                {column}
              </TableColumnHeader>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.length === 0 && <TableEmpty>{t("admin.empty")}</TableEmpty>}
          {rows.map((row, index) => (
            <TableRow key={index}>
              {columns.map((column) => (
                <TableCell key={column} text="nowrap">
                  {cellText(row[column], cells)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </TableContent>
    </Table>
  );
}
