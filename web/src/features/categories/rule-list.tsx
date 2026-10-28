import type { GridColumn } from "@slotted/core/grid";
import { DataGrid } from "@slotted/react/data-grid";
import { Switch } from "@slotted/react/switch";
import { Text } from "@slotted/react/typography";
import { VisuallyHidden } from "@slotted/react/visually-hidden";
import { useCallback, useMemo } from "react";

import type { components } from "@/api/schema.gen";
import type { RuleWords } from "@/features/categories/rule-sentence";
import { ruleSummary } from "@/features/categories/rule-summary";
import styles from "@/features/categories/rule-list.module.css";
import { formatDate } from "@/i18n/format";
import { RuleActions } from "@/features/categories/rule-actions";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useStableCallback } from "@/ui/use-stable-callback";

type Rule = components["schemas"]["Rule"];

export type RuleAction = "edit" | "top" | "up" | "down" | "delete";

// The rules in the order they run; the grip and the menu move them (BD-04).
export function RuleList({
  rules,
  words,
  loading,
  onToggle,
  onReorder,
  onAction,
}: {
  rules: readonly Rule[];
  words: RuleWords;
  loading: boolean;
  onToggle: (rule: Rule, enabled: boolean) => void;
  onReorder: (ids: string[]) => void;
  onAction: (rule: Rule, action: RuleAction) => void;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const columns = useMemo<GridColumn<Rule>[]>(
    () => [
      {
        id: "enabled",
        label: t("rules.enabled"),
        accessor: "enabled",
        width: 104,
        sortable: false,
      },
      {
        id: "name",
        label: t("rules.name"),
        accessor: "name",
        rowHeader: true,
        flex: 1,
        minWidth: 180,
        sortable: false,
      },
      {
        id: "summary",
        label: t("rules.summary"),
        accessor: (rule) => ruleSummary(rule, words),
        flex: 2,
        minWidth: 240,
        priority: 2,
        sortable: false,
      },
      {
        id: "usage",
        label: t("rules.usage"),
        accessor: "categorized_count",
        numeric: true,
        // Holds the count and the date of the last decision side by side.
        width: 240,
        priority: 1,
        sortable: false,
      },
      {
        id: "actions",
        label: t("category.actionsColumn"),
        kind: "actions",
        accessor: () => "",
        width: 56,
        sortable: false,
      },
    ],
    [t, words],
  );

  const toggle = useStableCallback(onToggle);
  const act = useStableCallback(onAction);
  const renderHeader = useCallback(
    ({ column }: { column: { id: string; label: string } }) =>
      column.id === "actions" ? (
        <VisuallyHidden>{column.label}</VisuallyHidden>
      ) : (
        column.label
      ),
    [],
  );
  const renderEmpty = useCallback(
    () => (
      <Text tone="muted" className={styles.empty}>
        {t("rules.empty")}
      </Text>
    ),
    [t],
  );
  const cellRenderers = useMemo(
    () => ({
      enabled: ({ row }: { row: Rule }) => (
        <Switch
          aria-label={t("rules.enableNamed", { name: row.name })}
          checked={row.enabled}
          onCheckedChange={(checked) => {
            toggle(row, checked);
          }}
        />
      ),
      summary: ({ text }: { text: string }) => (
        <span className={styles.cut} title={text}>
          {text}
        </span>
      ),
      usage: ({ row }: { row: Rule }) => (
        <span className={styles.usage}>
          <Text numeric="tabular">
            {t("rules.count", { count: row.categorized_count })}
          </Text>
          {row.last_categorized_at !== undefined && (
            <Text size="sm" tone="muted">
              {formatDate(row.last_categorized_at.slice(0, 10), locale)}
            </Text>
          )}
        </span>
      ),
      actions: ({ row }: { row: Rule }) => (
        <RuleActions rule={row} onAction={act} />
      ),
    }),
    [t, locale, toggle, act],
  );

  return (
    <DataGrid
      aria-label={t("categories.tab.rules")}
      variant="framed"
      // The row's actions stay in view when the columns scroll sideways; a row of 44 px keeps
      // the small icon button inside the current-cell ring.
      defaultColumnState={{ pinned: { start: [], end: ["actions"] } }}
      rowHeight={44}
      columns={columns}
      rows={rules}
      rowKey="id"
      loading={loading}
      rowsReorderable
      onRowsReorder={({ from, to }) => {
        const ids = rules.map((r) => r.id);
        const [moved] = ids.splice(from, 1);
        if (moved === undefined) return;
        ids.splice(to, 0, moved);
        onReorder(ids);
      }}
      renderHeader={renderHeader}
      renderEmpty={renderEmpty}
      cellRenderers={cellRenderers}
    />
  );
}
