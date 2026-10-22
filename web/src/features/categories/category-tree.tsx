import type { GridColumn } from "@slotted/core/grid";
import { Badge } from "@slotted/react/badge";
import { DataGrid } from "@slotted/react/data-grid";
import { Text } from "@slotted/react/typography";
import { VisuallyHidden } from "@slotted/react/visually-hidden";
import { useCallback, useMemo } from "react";

import { CategoryMark } from "@/features/categories/category-mark";
import type { CategoryEntry } from "@/features/categories/category-paths";
import { CategoryRowMenu } from "@/features/categories/category-row-menu";
import type { CategoryAction } from "@/features/categories/category-row-menu";
import styles from "@/features/categories/category-tree.module.css";
import { ShareBar } from "@/features/categories/share-bar";
import { formatMoney } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useStableCallback } from "@/ui/use-stable-callback";

export interface TreeRow {
  id: string;
  parentId: string | null;
  entry: CategoryEntry;
  // Minor units in the base currency, signed as the class reads: spent or earned, positive.
  own: number;
  subtree: number;
  share: number;
}

// Workaround for Slotted finding "A new tree object rebuilds every row of a data-grid": a
// page render, a dialog opening, rendered every row of the tree, so the object is a constant.
const tree = { parentKey: (row: TreeRow) => row.parentId };

export function CategoryTree({
  rows,
  currency,
  scale,
  loading,
  onAction,
}: {
  rows: readonly TreeRow[];
  currency: string;
  scale: number;
  loading: boolean;
  onAction: (entry: CategoryEntry, action: CategoryAction) => void;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const expanded = useMemo(
    () => [
      ...new Set(
        rows.flatMap((r) => (r.parentId === null ? [] : [r.parentId])),
      ),
    ],
    [rows],
  );

  const columns = useMemo<GridColumn<TreeRow>[]>(() => {
    const format = (amount: number) =>
      formatMoney({ amount, currency }, scale, locale);
    return [
      {
        id: "name",
        label: t("category.name"),
        accessor: (row) => row.entry.name,
        rowHeader: true,
        flex: 2,
        // Narrow enough that the total keeps its column beside it on a 390 px phone.
        minWidth: 150,
      },
      {
        id: "subtree",
        label: t("category.total"),
        description: t("category.totalHint"),
        accessor: "subtree",
        numeric: true,
        width: 140,
        priority: 1,
        format: (value) => format(Number(value)),
      },
      {
        id: "own",
        label: t("category.own"),
        description: t("category.ownHint"),
        accessor: "own",
        numeric: true,
        width: 140,
        priority: 3,
        format: (value) => format(Number(value)),
      },
      {
        id: "share",
        label: t("category.share"),
        accessor: "share",
        width: 180,
        priority: 2,
      },
      {
        id: "actions",
        label: t("category.actionsColumn"),
        kind: "actions",
        accessor: () => "",
        width: 56,
        sortable: false,
      },
    ];
  }, [t, locale, currency, scale]);

  const percent = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: "percent",
        maximumFractionDigits: 1,
      }),
    [locale],
  );

  // Workaround for Slotted finding "Data-grid re-renders every row when messages or a renderer
  // changes identity": a render of the page around the tree, a dialog opening, would render every
  // row, so the renderers keep their identity.
  const act = useStableCallback(onAction);
  const renderHeader = useCallback(
    ({ column }: { column: { id: string; label: string } }) =>
      // The actions column is named for a screen reader and draws no words over its menus.
      column.id === "actions" ? (
        <VisuallyHidden>{column.label}</VisuallyHidden>
      ) : (
        column.label
      ),
    [],
  );
  const cellRenderers = useMemo(
    () => ({
      name: ({ row }: { row: TreeRow }) => (
        <span className={styles.name} title={row.entry.path}>
          <CategoryMark
            name={row.entry.name}
            color={row.entry.color}
            icon={row.entry.icon}
          />
          <Text className={styles.cut}>{row.entry.name}</Text>
          {row.entry.archived && (
            <Badge size="sm" tone="secondary">
              {t("category.archived")}
            </Badge>
          )}
        </span>
      ),
      share: ({ row }: { row: TreeRow }) => (
        <span className={styles.share}>
          <ShareBar share={row.share} color={row.entry.color} />
          <Text size="sm" tone="muted" numeric="tabular">
            {percent.format(row.share)}
          </Text>
        </span>
      ),
      actions: ({ row }: { row: TreeRow }) => (
        <CategoryRowMenu
          entry={row.entry}
          onAction={(action) => {
            act(row.entry, action);
          }}
        />
      ),
    }),
    [t, percent, act],
  );

  return (
    <DataGrid
      aria-label={t("nav.categories")}
      variant="framed"
      // The row's actions stay in view when the columns scroll sideways; a row of 44 px keeps
      // the small icon button inside the current-cell ring.
      defaultColumnState={{ pinned: { start: [], end: ["actions"] } }}
      rowHeight={44}
      columns={columns}
      rows={rows}
      rowKey="id"
      tree={tree}
      defaultExpanded={expanded}
      loading={loading}
      height="100%"
      renderHeader={renderHeader}
      cellRenderers={cellRenderers}
    />
  );
}
