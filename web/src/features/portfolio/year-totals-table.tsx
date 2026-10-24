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
import { Stack } from "@slotted/react/stack";
import { Heading, Text } from "@slotted/react/typography";

import { compactQuery, useMediaQuery } from "@/ui/use-media-query";

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
  const compact = useMediaQuery(compactQuery);
  // Below 600 px four numeric columns clip the last one: each row becomes a group of lines.
  if (compact)
    return (
      <Stack gap={2} role="group" aria-label={caption}>
        <Heading level={3} size="sm">
          {caption}
        </Heading>
        {rows.map((row) => (
          <Stack key={row.key} gap={0}>
            <Text size="md" weight="semibold">
              {row.cells[0]}
            </Text>
            {row.cells.slice(1).map((cell, i) => (
              <Text key={headers[i + 1]} size="sm" tone="muted">
                {[headers[i + 1], cell].join(": ")}
              </Text>
            ))}
          </Stack>
        ))}
      </Stack>
    );
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
