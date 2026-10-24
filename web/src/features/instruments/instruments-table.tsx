import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableColumnHeader,
  TableContent,
  TableGroupRow,
  TableHead,
  TableLoader,
  TableRow,
  TableRowHeader,
} from "@slotted/react/table";
import { Link } from "@tanstack/react-router";
import { Fragment } from "react";

import type { InstrumentGroup } from "@/features/instruments/instrument-groups";
import {
  subtypeLabel,
  typeLabel,
} from "@/features/instruments/instrument-labels";
import { PriceCell } from "@/features/instruments/price-cell";
import type { LatestPrice } from "@/features/instruments/use-latest-prices";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

// The instruments under one group row per type: code, name, subtype, quote currency, exchange,
// latest price and its date.
export function InstrumentsTable({
  groups,
  latest,
  loading,
}: {
  groups: readonly InstrumentGroup[];
  latest: ReadonlyMap<string, LatestPrice>;
  loading: boolean;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  return (
    <Table columns={7} variant="framed">
      <TableContent>
        <TableCaption>{t("instruments.caption")}</TableCaption>
        <TableHead>
          <TableRow>
            <TableColumnHeader>{t("instruments.col.code")}</TableColumnHeader>
            <TableColumnHeader>{t("instruments.col.name")}</TableColumnHeader>
            <TableColumnHeader>
              {t("instruments.col.subtype")}
            </TableColumnHeader>
            <TableColumnHeader>{t("instruments.col.quote")}</TableColumnHeader>
            <TableColumnHeader>
              {t("instruments.col.exchange")}
            </TableColumnHeader>
            <TableColumnHeader numeric>
              {t("instruments.col.price")}
            </TableColumnHeader>
            <TableColumnHeader>
              {t("instruments.col.priceDate")}
            </TableColumnHeader>
          </TableRow>
        </TableHead>
        {loading ? (
          <TableLoader skeletonRows={4} />
        ) : (
          <TableBody>
            {groups.map((group) => (
              <Fragment key={group.type}>
                <TableGroupRow>{typeLabel(t, group.type)}</TableGroupRow>
                {group.items.map((i) => {
                  const price = latest.get(i.code)?.price;
                  return (
                    <TableRow key={i.code} value={i.code}>
                      <TableRowHeader text="truncate">
                        <Link to="/instruments/$code" params={{ code: i.code }}>
                          {i.code}
                        </Link>
                      </TableRowHeader>
                      <TableCell text="truncate">{i.name}</TableCell>
                      <TableCell>
                        {i.subtype === undefined
                          ? ""
                          : subtypeLabel(t, i.subtype)}
                      </TableCell>
                      <TableCell>{i.quote_currency ?? ""}</TableCell>
                      <TableCell>{i.exchange ?? ""}</TableCell>
                      <TableCell numeric>
                        <PriceCell latest={latest.get(i.code)} />
                      </TableCell>
                      <TableCell>
                        {price === null || price === undefined
                          ? ""
                          : formatDate(price.date, locale)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </Fragment>
            ))}
          </TableBody>
        )}
      </TableContent>
    </Table>
  );
}
