import { useMemo } from "react";

import { ChangeCell } from "@/features/instruments/catalog/change-cell";
import { NameCell } from "@/features/instruments/catalog/name-cell";
import { PriceCell } from "@/features/instruments/catalog/price-cell";
import { PriceDateCell } from "@/features/instruments/catalog/price-date-cell";
import { RowText } from "@/features/instruments/catalog/row-text";
import { TrendCell } from "@/features/instruments/catalog/trend-cell";
import { HideInstrumentRowButton } from "@/features/instruments/hide-instrument/hide-instrument-row-button";
import type { CatalogRow } from "@/features/instruments/model/catalog-rows";
import { AppLink } from "@/ui/navigation/app-link";

interface CellContext {
  row: CatalogRow;
}

const changeIds = ["week", "month", "quarter", "year", "yearToDate"] as const;

// The cells of the catalog, every one in the ink of its row. `quotesFailed` reaches the price.
export function useCatalogCells(quotesFailed: boolean) {
  return useMemo(
    () => ({
      actions: ({ row }: CellContext) => <HideInstrumentRowButton row={row} />,
      code: ({ row }: CellContext) => (
        <AppLink
          variant="neutral"
          underline="hover"
          to={{ to: "/instruments/$code", params: { code: row.code } }}
        >
          <RowText row={row}>{row.code}</RowText>
        </AppLink>
      ),
      name: ({ row }: CellContext) => <NameCell row={row} />,
      price: ({ row }: CellContext) => (
        <RowText row={row}>
          <PriceCell row={row} failed={quotesFailed} />
        </RowText>
      ),
      trend: ({ row }: CellContext) => <TrendCell row={row} />,
      priceDate: ({ row }: CellContext) => (
        <RowText row={row}>
          <PriceDateCell row={row} />
        </RowText>
      ),
      ...Object.fromEntries(
        changeIds.map((id) => [
          id,
          ({ row }: CellContext) => (
            <ChangeCell bp={row[id]} muted={row.hidden} />
          ),
        ]),
      ),
      ...Object.fromEntries(
        (["quoteCurrency", "subtype", "exchange"] as const).map((id) => [
          id,
          ({ row }: CellContext) => <RowText row={row}>{row[id]}</RowText>,
        ]),
      ),
    }),
    [quotesFailed],
  );
}
