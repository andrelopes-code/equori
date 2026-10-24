import type { GridColumn, GridQuery } from "@slotted/core/grid";
import { emptyQuery, withFilter, withSearch } from "@slotted/core/grid";
import { DataGrid } from "@slotted/react/data-grid";
import { FilterBar } from "@slotted/react/filter-bar";
import type { FilterBarField } from "@slotted/react/filter-bar";
import { Text } from "@slotted/react/typography";
import { useCallback, useMemo, useState } from "react";

import type { CatalogRow } from "@/features/instruments/catalog-rows";
import {
  subtypeLabel,
  typeLabel,
} from "@/features/instruments/instrument-labels";
import { LatestPriceCell } from "@/features/instruments/latest-price-cell";
import styles from "@/features/instruments/instruments-page.module.css";
import { useT } from "@/i18n/i18n-provider";
import { compactQuery, useMediaQuery } from "@/ui/use-media-query";

const initialQuery: GridQuery = {
  ...emptyQuery(),
  group: ["type"],
  sort: [{ column: "code", direction: "ascending" }],
};

const distinct = (rows: readonly CatalogRow[], key: keyof CatalogRow) =>
  [...new Set(rows.map((r) => r[key]).filter((v) => v !== ""))].sort();

// The instruments grouped by type, searched by code or name and filtered by type, subtype or
// quote currency. The grid windows its rows and each visible row asks for its own latest price.
export function InstrumentsGrid({
  rows,
  loading,
}: {
  rows: readonly CatalogRow[];
  loading: boolean;
}) {
  const t = useT();
  const compact = useMediaQuery(compactQuery);
  const [query, setQuery] = useState<GridQuery>(initialQuery);
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
      {
        id: "code",
        label: t("instruments.col.code"),
        accessor: "code",
        rowHeader: true,
        searchable: true,
        width: compact ? 110 : 120,
      },
      {
        id: "name",
        label: t("instruments.col.name"),
        accessor: "name",
        searchable: true,
        flex: 1,
        minWidth: compact ? 100 : 200,
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
        id: "subtype",
        label: t("instruments.col.subtype"),
        accessor: "subtype",
        kind: "set",
        options: subtypeOptions,
        width: 130,
        priority: 5,
      },
      {
        id: "quoteCurrency",
        label: t("instruments.col.quote"),
        accessor: "quoteCurrency",
        kind: "set",
        options: quoteOptions,
        width: 170,
        priority: 4,
      },
      {
        id: "exchange",
        label: t("instruments.col.exchange"),
        accessor: "exchange",
        width: 110,
        priority: 7,
      },
      {
        id: "price",
        label: t("instruments.col.price"),
        accessor: () => "",
        numeric: true,
        sortable: false,
        width: compact ? 130 : 150,
        priority: 1,
      },
      {
        id: "priceDate",
        label: t("instruments.col.priceDate"),
        accessor: () => "",
        sortable: false,
        width: 150,
        priority: 2,
      },
    ],
    [t, compact, typeOptions, subtypeOptions, quoteOptions],
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
  // Workaround for Slotted finding "Data-grid re-renders every row when messages or a renderer
  // changes identity": the renderers keep their identity across renders of the page.
  const cellRenderers = useMemo(
    () => ({
      price: ({ row }: { row: CatalogRow }) => (
        <LatestPriceCell row={row} part="price" />
      ),
      priceDate: ({ row }: { row: CatalogRow }) => (
        <LatestPriceCell row={row} part="date" />
      ),
    }),
    [],
  );
  const renderGroup = useCallback(
    ({ node }: { node: { rows: readonly CatalogRow[] } }) => {
      const label = `${typeLabel(t, node.rows[0]?.type ?? "")} · ${String(node.rows.length)}`;
      return <Text weight="semibold">{label}</Text>;
    },
    [t],
  );
  return (
    <div className={styles.region}>
      <FilterBar
        fields={fields}
        value={query.filter ?? null}
        onValueChange={(filter) => {
          setQuery((current) => withFilter(current, filter).query);
        }}
        query={query.search}
        onQueryChange={(text) => {
          setQuery((current) => withSearch(current, text).query);
        }}
        queryDelay={0}
        count={rows.length}
        total={rows.length}
        messages={{ search: t("instruments.search") }}
      />
      <div className={styles.listing}>
        <DataGrid
          aria-label={t("instruments.caption")}
          variant="framed"
          columns={columns}
          rows={rows}
          rowKey="code"
          rowHeight={44}
          // The group rows carry the type, so its own column stays out of sight. A phone keeps the
          // code, the name and the price: the pop-in of the other columns would draw each row
          // tall with mostly empty facts.
          key={compact ? "compact" : "wide"}
          defaultColumnState={{
            hidden: compact
              ? ["type", "subtype", "quoteCurrency", "exchange", "priceDate"]
              : ["type"],
          }}
          loading={loading}
          query={query}
          onQueryChange={setQuery}
          height="100%"
          cellRenderers={cellRenderers}
          renderGroup={renderGroup}
        />
      </div>
    </div>
  );
}
