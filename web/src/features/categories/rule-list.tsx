import type { GridColumn } from "@slotted/core/grid";
import { IconButton } from "@slotted/react/button";
import { DataGrid } from "@slotted/react/data-grid";
import { Glyph, Icon } from "@slotted/react/icon";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
} from "@slotted/react/menu";
import { Switch } from "@slotted/react/switch";
import { Text } from "@slotted/react/typography";
import { VisuallyHidden } from "@slotted/react/visually-hidden";
import { useMemo } from "react";

import type { components } from "@/api/schema.gen";
import type { RuleWords } from "@/features/categories/rule-sentence";
import { ruleSummary } from "@/features/categories/rule-summary";
import styles from "@/features/categories/rule-list.module.css";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

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
        width: 220,
        sortable: false,
      },
      {
        id: "summary",
        label: t("rules.summary"),
        accessor: (rule) => ruleSummary(rule, words),
        flex: 1,
        minWidth: 240,
        priority: 2,
        sortable: false,
      },
      {
        id: "usage",
        label: t("rules.usage"),
        accessor: "categorized_count",
        numeric: true,
        width: 150,
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

  return (
    <DataGrid
      aria-label={t("categories.tab.rules")}
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
      renderHeader={({ column }) =>
        column.id === "actions" ? (
          <VisuallyHidden>{column.label}</VisuallyHidden>
        ) : (
          column.label
        )
      }
      renderEmpty={() => (
        <Text tone="muted" className={styles.empty}>
          {t("rules.empty")}
        </Text>
      )}
      cellRenderers={{
        enabled: ({ row }) => (
          <Switch
            aria-label={t("rules.enableNamed", { name: row.name })}
            checked={row.enabled}
            onCheckedChange={(checked) => {
              onToggle(row, checked);
            }}
          />
        ),
        summary: ({ text }) => (
          <span className={styles.cut} title={text}>
            {text}
          </span>
        ),
        usage: ({ row }) => (
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
        actions: ({ row }) => (
          <Menu>
            <MenuTrigger
              render={(props) => (
                <IconButton
                  {...props}
                  size="sm"
                  variant="ghost"
                  tone="secondary"
                  aria-label={t("rules.actions", { name: row.name })}
                >
                  <Icon>
                    <Glyph name="ellipsis" />
                  </Icon>
                </IconButton>
              )}
            />
            <MenuContent>
              <MenuItem
                onSelect={() => {
                  onAction(row, "edit");
                }}
              >
                {t("rules.edit")}
              </MenuItem>
              <MenuItem
                onSelect={() => {
                  onAction(row, "top");
                }}
              >
                {t("rules.moveTop")}
              </MenuItem>
              <MenuItem
                onSelect={() => {
                  onAction(row, "up");
                }}
              >
                {t("rules.moveUp")}
              </MenuItem>
              <MenuItem
                onSelect={() => {
                  onAction(row, "down");
                }}
              >
                {t("rules.moveDown")}
              </MenuItem>
              <MenuSeparator />
              <MenuItem
                tone="danger"
                onSelect={() => {
                  onAction(row, "delete");
                }}
              >
                {t("rules.delete")}
              </MenuItem>
            </MenuContent>
          </Menu>
        ),
      }}
    />
  );
}
