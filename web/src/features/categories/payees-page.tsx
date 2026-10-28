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
import type { components } from "@/api/schema.gen";
import { AliasesDrawer } from "@/features/categories/aliases-drawer";
import { payeeAliasesQuery, useRenamePayee } from "@/features/categories/api";
import { CategoriesHeader } from "@/features/categories/categories-header";
import styles from "@/features/categories/categories-page.module.css";
import { HeaderAction } from "@/ui/header-action";
import { MergePayeesDialog } from "@/features/categories/merge-payees-dialog";
import { PayeeActions } from "@/features/categories/payee-actions";
import { NewPayeeDialog } from "@/features/categories/new-payee-dialog";
import { payeesQuery } from "@/features/setup";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { compactQuery, useMediaQuery } from "@/ui/use-media-query";

type Payee = components["schemas"]["Payee"];

interface PayeeRow {
  id: string;
  name: string;
  aliases: string;
}

export function PayeesPage() {
  const t = useT();
  const [locale] = useAppLocale();
  const api = useApi();
  const compact = useMediaQuery(compactQuery);
  const payees = useQuery(payeesQuery(api));
  const aliases = useQuery(payeeAliasesQuery(api));
  const rename = useRenamePayee();
  const [query, setQuery] = useState("");
  const shownQuery = useDeferredValue(query);
  const [selection, setSelection] = useState<readonly string[]>([]);
  const [merging, setMerging] = useState(false);
  const [aliasesOf, setAliasesOf] = useState<Payee | null>(null);
  const [creating, setCreating] = useState(false);

  const rows = useMemo((): PayeeRow[] => {
    const collator = new Intl.Collator(locale, { sensitivity: "base" });
    const byPayee = new Map<string, string[]>();
    for (const alias of aliases.data ?? []) {
      byPayee.set(alias.payee_id, [
        ...(byPayee.get(alias.payee_id) ?? []),
        alias.pattern,
      ]);
    }
    const needle = shownQuery.trim();
    return (payees.data ?? [])
      .filter(
        (p) =>
          needle === "" ||
          p.name
            .toLocaleLowerCase(locale)
            .includes(needle.toLocaleLowerCase(locale)),
      )
      .sort((a, b) => collator.compare(a.name, b.name))
      .map((p) => ({
        id: p.id,
        name: p.name,
        aliases: (byPayee.get(p.id) ?? []).join(", "),
      }));
  }, [payees.data, aliases.data, shownQuery, locale]);

  const byId = useMemo(
    () => new Map((payees.data ?? []).map((p) => [p.id, p])),
    [payees.data],
  );
  const messages = useMemo(
    () => ({
      // Workaround for Slotted issue #7.
      selectRow: ({ row }: { row: string }) =>
        t("transactions.selectRow", { row: byId.get(row)?.name ?? row }),
    }),
    [t, byId],
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
      actions: ({ row }: { row: PayeeRow }) => (
        <PayeeActions
          payee={row}
          onManageAliases={() => {
            const payee = byId.get(row.id);
            if (payee !== undefined) setAliasesOf(payee);
          }}
        />
      ),
    }),
    [byId],
  );

  const columns = useMemo<GridColumn<PayeeRow>[]>(
    () => [
      {
        id: "name",
        label: t("payees.name"),
        accessor: "name",
        rowHeader: true,
        editable: true,
        flex: 1,
        minWidth: 200,
      },
      {
        id: "aliases",
        label: t("payees.aliases"),
        accessor: "aliases",
        flex: 2,
        minWidth: 200,
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
                    {t("payees.merge")}
                  </Button>
                </ActionBarAction>
              </ActionBarActions>
            </ActionBar>
          </PageFooter>
        ) : undefined
      }
    >
      <CategoriesHeader
        current="payees"
        actions={
          <HeaderAction
            primary
            label={t("payees.new")}
            glyph="plus"
            onClick={() => {
              setCreating(true);
            }}
          />
        }
      />
      <PageBody>
        <div className={styles.region}>
          <FilterBar
            fields={[]}
            value={null}
            query={query}
            onQueryChange={setQuery}
            queryDelay={0}
            count={rows.length}
            total={payees.data?.length ?? 0}
            messages={{ search: t("payees.search") }}
          />
          <div className={styles.listing}>
            <DataGrid
              aria-label={t("categories.tab.payees")}
              variant="framed"
              // The row's actions stay in view when the columns scroll sideways; a row of 44 px keeps
              // the small icon button inside the current-cell ring.
              defaultColumnState={{ pinned: { start: [], end: ["actions"] } }}
              rowHeight={44}
              columns={columns}
              rows={rows}
              rowKey="id"
              loading={payees.isPending}
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
                  await rename.mutateAsync({ id: commit.key, name });
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
        <MergePayeesDialog
          payees={selection.flatMap((id) => {
            const payee = byId.get(id);
            return payee === undefined ? [] : [payee];
          })}
          onCancel={() => {
            setMerging(false);
          }}
          onDone={() => {
            setMerging(false);
            setSelection([]);
            toast.show({ tone: "success", title: t("payees.merged") });
          }}
        />
      )}
      {creating && (
        <NewPayeeDialog
          onCancel={() => {
            setCreating(false);
          }}
          onDone={(name) => {
            setCreating(false);
            toast.show({
              tone: "success",
              title: t("payees.created", { name }),
            });
          }}
        />
      )}
      {aliasesOf !== null && (
        <AliasesDrawer
          payee={aliasesOf}
          aliases={aliases.data ?? []}
          onClose={() => {
            setAliasesOf(null);
          }}
        />
      )}
    </Page>
  );
}
