import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableColumnHeader,
  TableContent,
  TableHead,
  TableRow,
} from "@slotted/react/table";

export interface TotalsTableRow {
  key: string;
  cells: string[];
}

// The totals of a report: the group, then one figure per column, one row per group and currency.
export function YearTotalsTable({
  caption,
  headers,
  rows,
}: {
  caption: string;
  headers: string[];
  rows: TotalsTableRow[];
}) {
  // Below 600 px four numeric columns clip the last one: each row becomes a group of lines.
  return (
    <Table columns={headers.length} variant="framed">
      <TableContent>
        <TableCaption>{caption}</TableCaption>
        <TableHead>
          <TableRow>
            {headers.map((header, i) => (
              <TableColumnHeader key={header} numeric={i > 0}>
                {header}
              </TableColumnHeader>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.key}>
              {row.cells.map((cell, i) => (
                // The cells of a row are positional: the header at the same index names them.
                <TableCell key={i} numeric={i > 0}>
                  {cell}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </TableContent>
    </Table>
  );
}
