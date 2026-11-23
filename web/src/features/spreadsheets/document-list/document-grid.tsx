import type { GridColumn } from "@slotted/core/grid";
import { DataGrid } from "@slotted/react/data-grid";
import { FilterBar } from "@slotted/react/filter-bar";
import { Link } from "@slotted/react/link";
import { VisuallyHidden } from "@slotted/react/visually-hidden";
import { useNavigate } from "@tanstack/react-router";
import { useDeferredValue, useMemo, useState } from "react";

import type { SpreadsheetSummary } from "@/features/spreadsheets/api";
import type { DocumentCommand } from "@/features/spreadsheets/document-list/document-command";
import styles from "@/features/spreadsheets/document-list/document-grid.module.css";
import { DocumentMenu } from "@/features/spreadsheets/document-list/document-menu";
import { filterDocuments } from "@/features/spreadsheets/model/filter-documents";
import { formatDate, formatTime, todayISO } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { routeTo } from "@/ui/navigation/route-to";

interface DocumentGridProps {
  documents: readonly SpreadsheetSummary[];
  loading: boolean;
  // Whether the reader may rename, copy and delete; without it the grid draws no menu.
  canWrite: boolean;
  onCommand: (command: DocumentCommand) => void;
}

// The spreadsheets as rows, the last saved first, under their search.
export function DocumentGrid({
  documents,
  loading,
  canWrite,
  onCommand,
}: DocumentGridProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const shownQuery = useDeferredValue(query);

  const rows = useMemo(
    () => filterDocuments(documents, shownQuery, locale),
    [documents, shownQuery, locale],
  );
  const columns = useMemo<GridColumn<SpreadsheetSummary>[]>(
    () => [
      {
        id: "name",
        label: t("spreadsheets.name"),
        accessor: "name",
        rowHeader: true,
        flex: 1,
        minWidth: 240,
      },
      {
        id: "modified",
        label: t("spreadsheets.modified"),
        accessor: (row) =>
          `${formatDate(todayISO(new Date(row.updated_at)), locale)} · ${formatTime(row.updated_at, locale)}`,
        width: 220,
      },
      ...(canWrite
        ? [
            {
              id: "actions",
              label: t("spreadsheets.actionsColumn"),
              kind: "actions" as const,
              accessor: () => "",
              width: 56,
              sortable: false,
            },
          ]
        : []),
    ],
    [t, locale, canWrite],
  );
  const cellRenderers = useMemo(
    () => ({
      name: ({ row }: { row: SpreadsheetSummary }) => (
        <Link
          render={routeTo({ to: "/spreadsheets/$id", params: { id: row.id } })}
        >
          {row.name}
        </Link>
      ),
      actions: ({ row }: { row: SpreadsheetSummary }) => (
        <DocumentMenu
          label={t("spreadsheets.actions", { name: row.name })}
          onOpen={() => {
            void navigate({ to: "/spreadsheets/$id", params: { id: row.id } });
          }}
          onCommand={(kind) => {
            onCommand({ kind, document: row });
          }}
        />
      ),
    }),
    [t, navigate, onCommand],
  );

  return (
    <div className={styles.region}>
      <FilterBar
        // The list has no field to filter by: the bar is its search and its count.
        readOnly
        fields={[]}
        value={null}
        query={query}
        onQueryChange={setQuery}
        queryDelay={0}
        count={rows.length}
        total={documents.length}
        messages={{ search: t("spreadsheets.search") }}
      />

      <div className={styles.listing}>
        <DataGrid
          aria-label={t("spreadsheets.title")}
          variant="framed"
          // The row's menu stays in view when the columns scroll sideways; a row of 44 px keeps
          // the small icon button inside the current-cell ring.
          defaultColumnState={{ pinned: { start: [], end: ["actions"] } }}
          rowHeight={44}
          columns={columns}
          rows={rows}
          rowKey="id"
          loading={loading}
          height="100%"
          renderHeader={({ column }) =>
            column.id === "actions" ? (
              <VisuallyHidden>{column.label}</VisuallyHidden>
            ) : (
              column.label
            )
          }
          cellRenderers={cellRenderers}
        />
      </div>
    </div>
  );
}
