import type { GridQuery } from "@slotted/core/grid";
import { emptyQuery, withFilter, withSearch } from "@slotted/core/grid";
import { DataGrid } from "@slotted/react/data-grid";
import { FilterBar } from "@slotted/react/filter-bar";
import { Text } from "@slotted/react/typography";
import { VisuallyHidden } from "@slotted/react/visually-hidden";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";

import { CatalogColumnManager } from "@/features/instruments/catalog/catalog-column-manager";
import { useCatalogCells } from "@/features/instruments/catalog/use-catalog-cells";
import { useCatalogColumns } from "@/features/instruments/catalog/use-catalog-columns";
import type { HideSelection } from "@/features/instruments/hide-instrument/use-hide-selection";
import type { CatalogRow } from "@/features/instruments/model/catalog-rows";
import { typeLabel } from "@/features/instruments/model/instrument-labels";
import styles from "@/features/instruments/pages/instruments-page.module.css";
import { useT } from "@/i18n/i18n-provider";
import { BulkOutcomeNotice } from "@/ui/feedback/bulk-outcome-notice";
import { useColumnState } from "@/ui/runtime/use-column-state";

interface InstrumentsGridProps {
  rows: readonly CatalogRow[];
  loading: boolean;
  // The read of the quotes failed: the price cells say so and the grid stays usable (IQ11).
  quotesFailed: boolean;
  selection: HideSelection;
}

const initialQuery: GridQuery = {
  ...emptyQuery(),
  group: ["type"],
};

const defaultColumnState = {
  pinned: { start: ["actions", "code"], end: [] },
};

// The instruments grouped by type, searched by code or name and filtered by type, subtype or
// quote currency. Every row carries its latest price and its changes, read once for the catalog.
export function InstrumentsGrid({
  rows,
  loading,
  quotesFailed,
  selection,
}: InstrumentsGridProps) {
  const t = useT();
  const navigate = useNavigate();
  const { columns, fields, types } = useCatalogColumns(rows);
  const [query, setQuery] = useState<GridQuery>(initialQuery);
  const [opened, setOpened] = useState<readonly string[] | undefined>();
  const [columnState, setColumnState] = useColumnState(
    "equori.instruments.columns",
    defaultColumnState,
  );
  // The group rows carry the type, so its own column stays out of sight.
  const shown = useMemo(
    () => ({ ...columnState, hidden: [...columnState.hidden, "type"] }),
    [columnState],
  );
  const cellRenderers = useCatalogCells(quotesFailed);
  const renderHeader = useCallback(
    ({ column }: { column: { id: string; label: string } }) =>
      // The actions column is named for a screen reader and draws no words over its buttons.
      column.id === "actions" ? (
        <VisuallyHidden>{column.label}</VisuallyHidden>
      ) : (
        column.label
      ),
    [],
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
      {selection.refusal !== null && (
        <BulkOutcomeNotice
          outcome={selection.refusal}
          summary="bulk.changed"
          labelOf={(code) => code}
        />
      )}

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
      >
        <CatalogColumnManager
          columns={columns}
          columnState={columnState}
          defaultColumnState={defaultColumnState}
          onColumnState={setColumnState}
        />
      </FilterBar>

      <div className={styles.listing}>
        <DataGrid
          aria-label={t("instruments.caption")}
          variant="framed"
          columns={columns}
          rows={rows}
          rowKey="code"
          rowHeight={44}
          columnState={shown}
          onColumnStateChange={setColumnState}
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
          selectionMode="multiple"
          // A currency has no hidden state, so it takes no mark (HD2).
          isRowSelectable={(row) => row.type !== "currency"}
          isRowMuted={(row) => row.hidden}
          value={selection.selection}
          onValueChange={(value) => {
            selection.setMarked(
              typeof value === "string" ? [value] : (value ?? []),
            );
          }}
          activatable
          onActivate={(event) => {
            void navigate({
              to: "/instruments/$code",
              params: { code: event.key },
            });
          }}
          cellRenderers={cellRenderers}
          renderGroup={renderGroup}
          renderHeader={renderHeader}
        />
      </div>
    </div>
  );
}
