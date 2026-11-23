import {
  Table,
  TableBody,
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
import { ShareBar } from "@/features/portfolio/allocation/share-bar";
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
  // Runs edge to edge at the end of a surface section, with no frame of its own.
  flush?: boolean;
}

const columns = 4;

// A value below zero is no part of the whole the shares divide.
const noShare = "—";

// D3: a proportion is read as a length beside its exact value and share, one table that replaces
// a chart and the table repeating its figures.
export function AllocationTable({
  caption,
  shareHeader,
  rows,
  total,
  pending,
  flush = false,
}: AllocationTableProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const fmt = useMoneyFormat();
  const scale = useScale();

  const money = (m: Money) => fmt.money(m, scale?.(m.currency) ?? 0);
  const percent = (bp: number) => formatBasisPoints(bp, tag);
  const share = (row: AllocationRow) =>
    row.value.amount < 0 ? noShare : percent(row.share);

  return (
    <Table columns={columns} variant={flush ? "ruled" : "framed"}>
      <TableContent aria-label={caption}>
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
                    <ShareBar share={row.share} />
                  </TableCell>
                  <TableCell numeric>{money(row.value)}</TableCell>
                  <TableCell numeric>{share(row)}</TableCell>
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
