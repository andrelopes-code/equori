import type { GridQuery } from "@slotted/core/grid";
import { emptyQuery, withFilter, withSearch } from "@slotted/core/grid";
import { DataGrid } from "@slotted/react/data-grid";
import { FilterBar } from "@slotted/react/filter-bar";
import { Inline } from "@slotted/react/inline";
import { Tag } from "@slotted/react/tag";
import { Text } from "@slotted/react/typography";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";

import { ChangeCell } from "@/features/instruments/catalog/change-cell";
import { PriceCell } from "@/features/instruments/catalog/price-cell";
import { PriceDateCell } from "@/features/instruments/catalog/price-date-cell";
import { TrendCell } from "@/features/instruments/catalog/trend-cell";
import { useCatalogColumns } from "@/features/instruments/catalog/use-catalog-columns";
import type { CatalogRow } from "@/features/instruments/model/catalog-rows";
import { typeLabel } from "@/features/instruments/model/instrument-labels";
import styles from "@/features/instruments/pages/instruments-page.module.css";
import { useT } from "@/i18n/i18n-provider";
import { AppLink } from "@/ui/navigation/app-link";

interface InstrumentsGridProps {
  rows: readonly CatalogRow[];
  loading: boolean;
  // The read of the quotes failed: the price cells say so and the grid stays usable (IQ11).
  quotesFailed: boolean;
}

const initialQuery: GridQuery = {
  ...emptyQuery(),
  group: ["type"],
};

// The instruments grouped by type, searched by code or name and filtered by type, subtype or
// quote currency. Every row carries its latest price and its changes, read once for the catalog.
export function InstrumentsGrid({
  rows,
  loading,
  quotesFailed,
}: InstrumentsGridProps) {
  const t = useT();
  const navigate = useNavigate();
  const { columns, fields, types } = useCatalogColumns(rows);
  const [query, setQuery] = useState<GridQuery>(initialQuery);
  const [opened, setOpened] = useState<readonly string[] | undefined>();
  const cellRenderers = useMemo(
    () => ({
      code: ({ row }: { row: CatalogRow }) => (
        <Inline align="center" wrap="wrap" gap={4}>
          <AppLink
            variant="neutral"
            underline="hover"
            to={{ to: "/instruments/$code", params: { code: row.code } }}
          >
            {row.code}
          </AppLink>
          {row.hidden && (
            <Tag size="sm" tone="secondary">
              {t("instrument.hidden")}
            </Tag>
          )}
        </Inline>
      ),
      price: ({ row }: { row: CatalogRow }) => (
        <PriceCell row={row} failed={quotesFailed} />
      ),
      trend: ({ row }: { row: CatalogRow }) => <TrendCell row={row} />,
      priceDate: ({ row }: { row: CatalogRow }) => <PriceDateCell row={row} />,
      week: ({ row }: { row: CatalogRow }) => <ChangeCell bp={row.week} />,
      month: ({ row }: { row: CatalogRow }) => <ChangeCell bp={row.month} />,
      quarter: ({ row }: { row: CatalogRow }) => (
        <ChangeCell bp={row.quarter} />
      ),
      year: ({ row }: { row: CatalogRow }) => <ChangeCell bp={row.year} />,
      yearToDate: ({ row }: { row: CatalogRow }) => (
        <ChangeCell bp={row.yearToDate} />
      ),
    }),
    [quotesFailed, t],
  );
  // PC20: every group opens except the currencies, which only a reader who wants them opens.
  const expandedGroups = useMemo(
    () =>
      opened ??
      types
        .filter((type) => type !== "currency")
        .map((type) => `type=${typeLabel(t, type)}`),
    [opened, types, t],
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
          // The group rows carry the type, so its own column stays out of sight.
          defaultColumnState={{ hidden: ["type"] }}
          loading={loading}
          query={query}
          onQueryChange={setQuery}
          expandedGroups={[...expandedGroups]}
          onExpandedGroupsChange={(keys) => {
            setOpened(
              keys === "all"
                ? types.map((type) => `type=${typeLabel(t, type)}`)
                : keys,
            );
          }}
          height="100%"
          activatable
          onActivate={(event) => {
            void navigate({
              to: "/instruments/$code",
              params: { code: event.key },
            });
          }}
          cellRenderers={cellRenderers}
          renderGroup={renderGroup}
        />
      </div>
    </div>
  );
}
