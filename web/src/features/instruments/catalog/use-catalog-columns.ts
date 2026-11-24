import type { GridColumn } from "@slotted/core/grid";
import type { FilterBarField } from "@slotted/react/filter-bar";
import { useMemo } from "react";

import type { CatalogRow } from "@/features/instruments/model/catalog-rows";
import {
  subtypeLabel,
  typeLabel,
} from "@/features/instruments/model/instrument-labels";
import { useT } from "@/i18n/i18n-provider";

// The change columns of IQ7, each with the key of its label and the row field it sorts by.
const changeColumns = [
  { id: "week", label: "instruments.col.week", priority: 4, width: 84 },
  { id: "month", label: "instruments.col.month", priority: 3, width: 84 },
  { id: "quarter", label: "instruments.col.quarter", priority: 4, width: 84 },
  { id: "year", label: "instruments.col.year", priority: 3, width: 84 },
  {
    id: "yearToDate",
    label: "instruments.col.yearToDate",
    priority: 5,
    width: 100,
  },
] as const;

// The grid columns and the filter fields of the catalog, and the types the rows hold.
export function useCatalogColumns(rows: readonly CatalogRow[]) {
  const t = useT();
  const types = useMemo(() => distinct(rows, "type"), [rows]);
  const subtypes = useMemo(() => distinct(rows, "subtype"), [rows]);
  const quotes = useMemo(() => distinct(rows, "quoteCurrency"), [rows]);
  const typeOptions = useMemo(
    () => types.map((value) => ({ value, label: typeLabel(t, value) })),
    [types, t],
  );
  const subtypeOptions = useMemo(
    () => subtypes.map((value) => ({ value, label: subtypeLabel(t, value) })),
    [subtypes, t],
  );
  const quoteOptions = useMemo(
    () => quotes.map((value) => ({ value, label: value })),
    [quotes],
  );
  const columns = useMemo<GridColumn<CatalogRow>[]>(
    () => [
      // The action on a row stands beside its mark and its code (A238 HD13).
      {
        id: "actions",
        label: t("instruments.col.actions"),
        kind: "actions",
        accessor: () => "",
        width: 56,
        sortable: false,
        hideable: false,
      },
      {
        id: "code",
        label: t("instruments.col.code"),
        accessor: "code",
        rowHeader: true,
        searchable: true,
        hideable: false,
        width: 100,
      },
      {
        id: "name",
        label: t("instruments.col.name"),
        accessor: "name",
        searchable: true,
        // One line in the fixed row height; a longer name ends in an ellipsis.
        text: "truncate",
        flex: 1,
        minWidth: 220,
        priority: 3,
      },
      {
        id: "type",
        label: t("instruments.col.type"),
        accessor: "type",
        kind: "set",
        options: typeOptions,
        width: 150,
        priority: 6,
      },
      {
        // Prices of different quote currencies do not compare (IQ10).
        id: "price",
        label: t("instruments.col.price"),
        accessor: () => "",
        numeric: true,
        sortable: false,
        width: 120,
        priority: 1,
      },
      {
        id: "trend",
        label: t("instruments.col.trend"),
        accessor: () => "",
        sortable: false,
        width: 160,
        priority: 3,
      },
      {
        // A row without a price holds null, which sorts after every date (IQ8).
        id: "priceDate",
        label: t("instruments.col.priceDate"),
        accessor: (row) => (row.lastDate === "" ? null : row.lastDate),
        kind: "date",
        sortable: true,
        width: 164,
        priority: 2,
      },
      ...changeColumns.map(
        ({ id, label, priority, width }): GridColumn<CatalogRow> => ({
          id,
          label: t(label),
          accessor: id,
          kind: "number",
          numeric: true,
          sortable: true,
          width,
          priority,
        }),
      ),
      // The static columns come last: on a narrow screen they scroll out, not the figures.
      {
        id: "quoteCurrency",
        label: t("instruments.col.quote"),
        accessor: "quoteCurrency",
        kind: "set",
        options: quoteOptions,
        width: 160,
        priority: 4,
      },
      {
        id: "subtype",
        label: t("instruments.col.subtype"),
        accessor: "subtype",
        kind: "set",
        options: subtypeOptions,
        width: 100,
        priority: 5,
      },
      {
        id: "exchange",
        label: t("instruments.col.exchange"),
        accessor: "exchange",
        width: 80,
        priority: 7,
      },
    ],
    [t, typeOptions, subtypeOptions, quoteOptions],
  );
  const fields = useMemo<FilterBarField[]>(
    () => [
      {
        key: "type",
        kind: "set",
        label: t("instruments.col.type"),
        options: typeOptions,
      },
      {
        key: "subtype",
        kind: "set",
        label: t("instruments.col.subtype"),
        options: subtypeOptions,
      },
      {
        key: "quoteCurrency",
        kind: "set",
        label: t("instruments.col.quote"),
        options: quoteOptions,
      },
    ],
    [t, typeOptions, subtypeOptions, quoteOptions],
  );

  return { columns, fields, types };
}

function distinct(
  rows: readonly CatalogRow[],
  key: "type" | "subtype" | "quoteCurrency",
) {
  return [...new Set(rows.map((r) => r[key]).filter((v) => v !== ""))].sort();
}
