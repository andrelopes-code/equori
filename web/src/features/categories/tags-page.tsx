import type { GridColumn } from "@slotted/core/grid";
import {
  ActionBar,
  ActionBarAction,
  ActionBarActions,
  ActionBarStatus,
} from "@slotted/react/action-bar";
import { Button } from "@slotted/react/button";
import { DataGrid } from "@slotted/react/data-grid";
import { FilterBar } from "@slotted/react/filter-bar";
import { Page, PageBody, PageFooter } from "@slotted/react/page";
import { toast } from "@slotted/react/toast";
import { VisuallyHidden } from "@slotted/react/visually-hidden";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useDeferredValue, useMemo, useState } from "react";

import { useApi } from "@/api/api-context";
import { errorText } from "@/api/problem";
import { useRenameTag } from "@/features/categories/api";
import { CategoriesHeader } from "@/features/categories/categories-header";
import styles from "@/features/categories/categories-page.module.css";
import { DeleteTagDialog } from "@/features/categories/delete-tag-dialog";
import { MergeTagsDialog } from "@/features/categories/merge-tags-dialog";
import { TagActions } from "@/features/categories/tag-actions";
import { tagsQuery } from "@/features/transactions";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { compactQuery, useMediaQuery } from "@/ui/use-media-query";

interface TagRow {
  name: string;
}

// The tags page follows the payees page: rename in the cell, merge a selection, delete from
// the row's menu.
export function TagsPage() {
  const t = useT();
  const [locale] = useAppLocale();
  const api = useApi();
  const compact = useMediaQuery(compactQuery);
  const tags = useQuery(tagsQuery(api));
  const rename = useRenameTag();
  const [query, setQuery] = useState("");
  const shownQuery = useDeferredValue(query);
  const [selection, setSelection] = useState<readonly string[]>([]);
  const [merging, setMerging] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const rows = useMemo((): TagRow[] => {
    const collator = new Intl.Collator(locale, { sensitivity: "base" });
    const needle = shownQuery.trim().toLocaleLowerCase(locale);
    return (tags.data ?? [])
      .filter((name) => needle === "" || name.includes(needle))
      .sort((a, b) => collator.compare(a, b))
      .map((name) => ({ name }));
  }, [tags.data, shownQuery, locale]);

  const messages = useMemo(
    () => ({
      selectRow: ({ row }: { row: string }) =>
        t("transactions.selectRow", { row }),
    }),
    [t],
  );
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
      actions: ({ row }: { row: TagRow }) => (
        <TagActions
          tag={row.name}
          onDelete={() => {
            setDeleting(row.name);
          }}
        />
      ),
    }),
    [],
  );

  const columns = useMemo<GridColumn<TagRow>[]>(
    () => [
      {
        id: "name",
        label: t("tags.name"),
        accessor: "name",
        rowHeader: true,
        editable: true,
        flex: 1,
        minWidth: 200,
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
    [t],
  );

  return (
    <Page
      width="full"
      fill
      footer={
        selection.length > 0 ? (
          <PageFooter>
            <ActionBar aria-label={t("selection.label")}>
              <ActionBarStatus>
                {t("selection.count", { count: selection.length })}
              </ActionBarStatus>
              <ActionBarActions>
                <ActionBarAction>
                  <Button
                    variant="ghost"
                    tone="secondary"
                    onClick={() => {
                      setSelection([]);
                    }}
                  >
                    {t("selection.clear")}
                  </Button>
                </ActionBarAction>
                <ActionBarAction>
                  <Button
                    disabled={selection.length < 2}
                    onClick={() => {
                      setMerging(true);
                    }}
                  >
                    {t("tags.merge")}
                  </Button>
                </ActionBarAction>
              </ActionBarActions>
            </ActionBar>
          </PageFooter>
        ) : undefined
      }
    >
      <CategoriesHeader current="tags" />
      <PageBody>
        <div className={styles.region}>
          <FilterBar
            fields={[]}
            value={null}
            query={query}
            onQueryChange={setQuery}
            queryDelay={0}
            count={rows.length}
            total={tags.data?.length ?? 0}
            messages={{ search: t("tags.search") }}
          />
          <div className={styles.listing}>
            <DataGrid
              aria-label={t("categories.tab.tags")}
              variant="framed"
              // The row's actions stay in view when the columns scroll sideways; a row of 44 px keeps
              // the small icon button inside the current-cell ring.
              defaultColumnState={{ pinned: { start: [], end: ["actions"] } }}
              rowHeight={44}
              columns={columns}
              rows={rows}
              rowKey="name"
              loading={tags.isPending}
              {...(compact ? {} : { height: "100%" })}
              selectionMode="multiple"
              value={selection}
              onValueChange={(value) => {
                setSelection(
                  typeof value === "string" ? [value] : (value ?? []),
                );
              }}
              messages={messages}
              onEditCommit={async (commit) => {
                const name = String(commit.value).trim();
                if (
                  commit.column !== "name" ||
                  name === "" ||
                  name === commit.previous
                )
                  return;
                try {
                  await rename.mutateAsync({ tag: commit.key, name });
                } catch (error) {
                  throw new Error(errorText(error, t), { cause: error });
                }
              }}
              renderHeader={renderHeader}
              cellRenderers={cellRenderers}
            />
          </div>
        </div>
      </PageBody>
      {merging && (
        <MergeTagsDialog
          tags={selection}
          onCancel={() => {
            setMerging(false);
          }}
          onDone={() => {
            setMerging(false);
            setSelection([]);
            toast.show({ tone: "success", title: t("tags.merged") });
          }}
        />
      )}
      {deleting !== null && (
        <DeleteTagDialog
          tag={deleting}
          onCancel={() => {
            setDeleting(null);
          }}
          onDone={() => {
            setSelection((current) => current.filter((n) => n !== deleting));
            setDeleting(null);
            toast.show({ tone: "success", title: t("tags.deleted") });
          }}
        />
      )}
    </Page>
  );
}
