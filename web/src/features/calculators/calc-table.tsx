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

import styles from "@/features/calculators/calculators.module.css";

export interface CalcTableRow {
  key: string;
  cells: readonly string[];
}

// A table of computed figures: the first cell of a row names it, the others are numbers in the
// column whose header has the same index. A long table (a schedule) scrolls in its own frame
// under a header that stays.
export function CalcTable({
  caption,
  headers,
  rows,
  long = false,
}: {
  caption: string;
  headers: readonly string[];
  rows: readonly CalcTableRow[];
  long?: boolean;
}) {
  return (
    <Table
      columns={headers.length}
      variant="framed"
      striped={long}
      stickyHeader={long}
    >
      <TableContent
        {...(long ? { scrollProps: { className: styles.scroll } } : {})}
      >
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
              <TableRowHeader text="nowrap">{row.cells[0]}</TableRowHeader>
              {row.cells.slice(1).map((cell, i) => (
                // The cells of a row are positional: the header at the same index names them.
                <TableCell key={i} numeric>
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
