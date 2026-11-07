import { ProgressBar } from "@slotted/react/progress-indicator";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableColumnHeader,
  TableContent,
  TableHead,
  TableLoader,
  TableRow,
  TableRowHeader,
  TableSummary,
} from "@slotted/react/table";

import type { components } from "@/api/schema.gen";
import { useScale } from "@/features/setup";
import { formatBasisPoints } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

type Money = components["schemas"]["Money"];

export interface AllocationRow {
  key: string;
  name: string;
  value: Money;
  // Basis points of the total.
  share: number;
}

interface AllocationTableProps {
  caption: string;
  shareHeader: string;
  rows: readonly AllocationRow[];
  total: Money | undefined;
  pending: boolean;
}

const columns = 4;

// D3: a proportion is read as a length beside its exact value and share, one table that replaces
// a chart and the table repeating its figures.
export function AllocationTable({
  caption,
  shareHeader,
  rows,
  total,
  pending,
}: AllocationTableProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const fmt = useMoneyFormat();
  const scale = useScale();

  const money = (m: Money) => fmt.money(m, scale?.(m.currency) ?? 0);
  const percent = (bp: number) => formatBasisPoints(bp, tag);

  return (
    <Table columns={columns} variant="framed">
      <TableContent>
        <TableCaption>{caption}</TableCaption>
        <TableHead>
          <TableRow>
            <TableColumnHeader>
              {t("portfolio.allocation.group")}
            </TableColumnHeader>
            <TableColumnHeader aria-label={t("holdings.bar")} />
            <TableColumnHeader numeric>
              {t("portfolio.allocation.value")}
            </TableColumnHeader>
            <TableColumnHeader numeric>{shareHeader}</TableColumnHeader>
          </TableRow>
        </TableHead>
        {pending ? (
          <TableLoader skeletonRows={3} />
        ) : (
          <>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.key} value={row.key}>
                  <TableRowHeader>{row.name}</TableRowHeader>
                  <TableCell>
                    <ProgressBar
                      aria-label={`${row.name}: ${percent(row.share)}`}
                      value={row.share / 100}
                    />
                  </TableCell>
                  <TableCell numeric>{money(row.value)}</TableCell>
                  <TableCell numeric>{percent(row.share)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            {total !== undefined && (
              <TableSummary>
                <TableRow>
                  <TableRowHeader colSpan={2}>
                    {t("portfolio.allocation.total")}
                  </TableRowHeader>
                  <TableCell numeric>{money(total)}</TableCell>
                  <TableCell numeric>{percent(10000)}</TableCell>
                </TableRow>
              </TableSummary>
            )}
          </>
        )}
      </TableContent>
    </Table>
  );
}
