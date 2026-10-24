import {
  Table,
  TableBody,
  TableCaption,
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
import { formatRate } from "@/features/instruments/rate";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { MASK } from "@/privacy/mask";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { PhoneList } from "@/ui/phone-list";
import { compactQuery, useMediaQuery } from "@/ui/use-media-query";

type Price = components["schemas"]["Price"];

// The chosen price of each date, newest first, with its source. Up to 366 rows of three cells.
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
  const compact = useMediaQuery(compactQuery);
  const rows = [...prices].sort((a, b) => b.date.localeCompare(a.date));
  const value = (p: Price) => (fmt.hidden ? MASK : formatRate(p.value, locale));
  if (compact)
    return (
      <PhoneList
        label={t("instrument.prices.caption")}
        loading={loading}
        empty={t("instrument.prices.empty")}
        rows={rows.map((p) => ({
          key: p.date,
          title: formatDate(p.date, locale),
          lines: [sourceLabel(t, p.source)],
          end: value(p),
        }))}
      />
    );
  return (
    <Table columns={3} variant="framed">
      <TableContent>
        <TableCaption>{t("instrument.prices.caption")}</TableCaption>
        <TableHead>
          <TableRow>
            <TableColumnHeader>{t("instrument.col.date")}</TableColumnHeader>
            <TableColumnHeader numeric>
              {t("instrument.col.price")}
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
            {rows.map((p) => (
              <TableRow key={p.date} value={p.date}>
                <TableRowHeader>{formatDate(p.date, locale)}</TableRowHeader>
                <TableCell numeric>{value(p)}</TableCell>
                <TableCell>{sourceLabel(t, p.source)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        )}
      </TableContent>
    </Table>
  );
}
