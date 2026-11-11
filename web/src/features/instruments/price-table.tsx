import {
  Table,
  TableBody,
  TableCell,
  TableColumnHeader,
  TableContent,
  TableEmpty,
  TableHead,
  TableLoader,
  TableRow,
  TableRowHeader,
} from "@slotted/react/table";

import type { components } from "@/api/schema.gen";
import { sourceLabel } from "@/features/instruments/instrument-labels";
import { formatPrice } from "@/features/instruments/rate";
import { changeBp } from "@/features/instruments/price-stats";
import { formatDate, formatSignedBasisPoints } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { MASK } from "@/privacy/mask";
import { useMoneyFormat } from "@/privacy/use-money-format";

type Price = components["schemas"]["Price"];

// The chosen price of each date, newest first, with its change against the older row and its source. The rows are the points of the answer.
export function PriceTable({
  prices,
  loading,
}: {
  prices: readonly Price[];
  loading: boolean;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const rows = [...prices].sort((a, b) => b.date.localeCompare(a.date));
  const value = (p: Price) =>
    fmt.hidden ? MASK : formatPrice(p.value, locale);
  const change = (p: Price, older: Price | undefined) => {
    const bp = older === undefined ? null : changeBp(older.value, p.value);
    if (bp === null) return "—";

    return fmt.hidden ? MASK : formatSignedBasisPoints(bp, locale);
  };

  return (
    <Table columns={4} variant="framed">
      <TableContent aria-label={t("instrument.prices.caption")}>
        <TableHead>
          <TableRow>
            <TableColumnHeader>{t("instrument.col.date")}</TableColumnHeader>
            <TableColumnHeader numeric>
              {t("instrument.col.price")}
            </TableColumnHeader>
            <TableColumnHeader numeric>
              {t("instrument.col.change")}
            </TableColumnHeader>
            <TableColumnHeader>{t("instrument.col.source")}</TableColumnHeader>
          </TableRow>
        </TableHead>
        {loading ? (
          <TableLoader skeletonRows={4} />
        ) : (
          <TableBody>
            {rows.length === 0 && (
              <TableEmpty>{t("instrument.prices.empty")}</TableEmpty>
            )}
            {rows.map((p, i) => (
              <TableRow key={p.date} value={p.date}>
                <TableRowHeader>{formatDate(p.date, locale)}</TableRowHeader>
                <TableCell numeric>{value(p)}</TableCell>
                <TableCell numeric>{change(p, rows[i + 1])}</TableCell>
                <TableCell>{sourceLabel(t, p.source)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        )}
      </TableContent>
    </Table>
  );
}
