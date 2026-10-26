import {
  AlertDialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@slotted/react/dialog";
import { Button } from "@slotted/react/button";
import { Inline } from "@slotted/react/inline";
import { Page, PageBody } from "@slotted/react/page";
import { Segment, SegmentedControl } from "@slotted/react/segmented-control";
import { Skeleton } from "@slotted/react/skeleton";
import { Stack } from "@slotted/react/stack";
import { Switch } from "@slotted/react/switch";
import { toast } from "@slotted/react/toast";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { RefreshButton } from "@/ui/refresh-button";
import { useRefresh } from "@/ui/use-refresh";
import { useApi } from "@/api/api-context";
import { errorText } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { accountsQuery } from "@/features/accounts";
import {
  categoryTotalsQuery,
  useArchiveCategory,
  useReopenCategory,
} from "@/features/categories/api";
import { CategoriesHeader } from "@/features/categories/categories-header";
import { validateCategoriesSearch } from "@/features/categories/categories-search";
import styles from "@/features/categories/categories-page.module.css";
import { HeaderAction } from "@/ui/header-action";
import { CategoryDialog } from "@/features/categories/category-dialog";
import { useCategoryEntries } from "@/features/categories/use-category-entries";
import type {
  CategoryClass,
  CategoryEntry,
} from "@/features/categories/category-paths";
import type { CategoryAction } from "@/features/categories/category-row-menu";
import { CategoryTree } from "@/features/categories/category-tree";
import type { TreeRow } from "@/features/categories/category-tree";
import { MergeDialog } from "@/features/categories/merge-dialog";
import {
  comparableBounds,
  daysCounted,
  lastMonths,
  monthBounds,
  previousMonth,
  summarize,
  trendOf,
} from "@/features/categories/category-figures";
import { CategoryCharts } from "@/features/categories/category-charts";
import { FiguresRow } from "@/features/categories/figures-row";
import { settingsQuery, useScale } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";
import { MonthControl } from "@/ui/month-control";
import { CategoryViewControl } from "@/features/categories/category-view-control";
import { CategoryViewNote } from "@/features/categories/category-view-note";
import { useStableCallback } from "@/ui/use-stable-callback";
import { useToday } from "@/i18n/today";

type Dialog =
  | { kind: "create"; parent: string | null }
  | { kind: "edit"; entry: CategoryEntry }
  | { kind: "merge"; entry: CategoryEntry }
  | { kind: "archive"; entry: CategoryEntry };

type Totals = readonly components["schemas"]["CategoryTotal"][];

// A function of the module, so that TanStack Query keeps the combined result between renders
// while no query's data has changed.
function combineHistory(
  results: readonly { data: Totals | undefined; isPending: boolean }[],
) {
  return {
    data: results.map((r) => r.data),
    pending: results.some((r) => r.isPending),
  };
}

export function CategoriesPage() {
  const t = useT();
  const queryClient = useQueryClient();

  const api = useApi();
  const today = useToday();
  const navigate = useNavigate({ from: "/categories" });
  const search = useSearch({ from: "/_authed/categories" });
  const month = search.month ?? today.slice(0, 7);
  const cls: CategoryClass = search.class ?? "expense";
  const view = search.view ?? "accrual";
  const showArchived = search.archived === true;
  const { from, to } = monthBounds(month);

  const accounts = useQuery(accountsQuery(api));
  const settings = useQuery(settingsQuery(api));
  const totals = useQuery(categoryTotalsQuery(api, from, to, cls, view));
  const before = previousMonth(month);
  const comparable = comparableBounds(month, today);
  const previousTotals = useQuery(
    categoryTotalsQuery(api, comparable.from, comparable.to, cls, view),
  );
  const scale = useScale();
  const archive = useArchiveCategory();
  const reopen = useReopenCategory();
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const closeArchive = useStableCallback((open: boolean) => {
    if (!open) setDialog(null);
  });

  // The same queries as the month and the month before: the cache answers those that match.
  const months = useMemo(() => lastMonths(month, 6), [month]);
  const history = useQueries({
    queries: months.map((m) => {
      const bounds = monthBounds(m);
      return categoryTotalsQuery(api, bounds.from, bounds.to, cls, view);
    }),
    combine: combineHistory,
  });

  const entries = useCategoryEntries(accounts.data);
  const currency = settings.data?.base_currency;

  const { rows, pending } = useMemo(() => {
    const byId = new Map(
      (totals.data ?? []).map((item) => [item.account_id, item]),
    );
    // The system accounts — fees, interest, taxes — stand in the tree only in a month that
    // touched them. The uncategorized holder is a queue, not a category: it leaves the tree
    // for the pending card and stays in the class total the shares divide.
    const shown = entries.filter(
      (e) =>
        e.class === cls &&
        (showArchived || !e.archived) &&
        (e.systemRole === undefined ||
          e.uncategorized ||
          (byId.get(e.id)?.subtree_total.amount ?? 0) !== 0),
    );
    const visible = new Set(shown.map((e) => e.id));
    const classTotal = shown
      .filter((e) => e.parentId === undefined || !visible.has(e.parentId))
      .reduce((sum, e) => sum + (byId.get(e.id)?.subtree_total.amount ?? 0), 0);
    const holder = shown
      .filter((e) => e.uncategorized)
      .reduce((sum, e) => sum + (byId.get(e.id)?.subtree_total.amount ?? 0), 0);
    const treeRows = shown
      .filter((entry) => !entry.uncategorized)
      .map((entry): TreeRow => {
        const item = byId.get(entry.id);
        const subtree = item?.subtree_total.amount ?? 0;
        return {
          id: entry.id,
          parentId:
            entry.parentId !== undefined && visible.has(entry.parentId)
              ? entry.parentId
              : null,
          entry,
          own: item?.total.amount ?? 0,
          subtree,
          share: classTotal > 0 ? subtree / classTotal : 0,
        };
      });
    return {
      rows: treeRows,
      pending:
        holder === 0
          ? null
          : { amount: holder, share: classTotal > 0 ? holder / classTotal : 0 },
    };
  }, [entries, totals.data, cls, showArchived]);

  const current = useMemo(
    () => summarize(entries, totals.data, cls),
    [entries, totals.data, cls],
  );
  const previous = useMemo(
    () =>
      previousTotals.data === undefined
        ? undefined
        : summarize(entries, previousTotals.data, cls),
    [entries, previousTotals.data, cls],
  );

  const trend = useMemo(
    () =>
      trendOf(
        entries,
        months.map((m, i) => ({ month: m, items: history.data[i] })),
        cls,
      ),
    [entries, months, cls, history.data],
  );

  const refreshing =
    !accounts.isPending &&
    (accounts.isFetching || totals.isFetching || previousTotals.isFetching);

  // An undefined key in the patch removes that parameter.
  const setSearch = (patch: Record<string, unknown>) => {
    void navigate({
      search: validateCategoriesSearch({ ...search, ...patch }),
      replace: true,
    });
  };

  const onAction = (entry: CategoryEntry, action: CategoryAction) => {
    switch (action) {
      case "transactions":
        void navigate({
          to: "/transactions",
          search: { account_id: entry.id, from, to },
        });
        return;
      case "edit":
        setDialog({ kind: "edit", entry });
        return;
      case "add-child":
        setDialog({ kind: "create", parent: entry.id });
        return;
      case "merge":
        setDialog({ kind: "merge", entry });
        return;
      case "archive":
        setDialog({ kind: "archive", entry });
        return;
      case "reopen":
        reopen.mutateAsync(entry.id).catch((error: unknown) => {
          toast.show({ tone: "danger", title: errorText(error, t) });
        });
        return;
    }
  };

  const refresh = useRefresh(() => queryClient.invalidateQueries());
  return (
    <Page width="full">
      <CategoriesHeader
        current="categories"
        refreshing={refreshing || refresh.refreshing}
        requested={refresh.refreshing}
        actions={
          <>
            <MonthControl
              label={t("category.month")}
              value={month}
              onChange={(next) => {
                setSearch({ month: next });
              }}
            />
            <RefreshButton
              label={t("category.refresh")}
              refreshing={refresh.refreshing}
              onRefresh={refresh.refresh}
            />
            <HeaderAction
              primary
              label={t("category.new")}
              glyph="plus"
              onClick={() => {
                setDialog({ kind: "create", parent: null });
              }}
            />
          </>
        }
      />
      <PageBody>
        <div className={styles.region}>
          <Inline gap={4} justify="between" align="center">
            <SegmentedControl
              aria-label={t("category.class")}
              value={cls}
              onValueChange={(value) => {
                if (value === "expense" || value === "income") {
                  setSearch({
                    class: value === "expense" ? undefined : value,
                  });
                }
              }}
            >
              <Segment value="expense">{t("category.group.expense")}</Segment>
              <Segment value="income">{t("category.group.income")}</Segment>
            </SegmentedControl>
            <CategoryViewControl
              value={view}
              onChange={(next) => {
                setSearch({ view: next === "cash" ? "cash" : undefined });
              }}
            />
            <Switch
              checked={showArchived}
              onCheckedChange={(checked) => {
                setSearch({ archived: checked ? true : undefined });
              }}
            >
              {t("category.showArchived")}
            </Switch>
          </Inline>
          <CategoryViewNote view={view} />
          <div className={styles.summary}>
            {scale !== null && currency !== undefined && (
              <FiguresRow
                cls={cls}
                currency={currency}
                scale={scale(currency)}
                previousMonth={before}
                comparable={comparable}
                from={from}
                to={to}
                days={daysCounted(month, today)}
                monthDays={Number(to.slice(8, 10))}
                current={current}
                previous={previous}
                pending={pending}
                loading={accounts.isPending || totals.isPending}
              />
            )}
            {scale !== null && currency !== undefined && (
              <CategoryCharts
                trend={trend}
                currency={currency}
                scale={scale(currency)}
                loading={history.pending}
              />
            )}
            {(scale === null || currency === undefined) && (
              <Stack gap={4} aria-busy="true">
                <Skeleton shape="block" blockSize="6rem" />
                <Skeleton shape="block" blockSize="16rem" />
              </Stack>
            )}
          </div>
          <div className={styles.listing}>
            {scale !== null && currency !== undefined && (
              <CategoryTree
                rows={rows}
                currency={currency}
                scale={scale(currency)}
                loading={accounts.isPending || totals.isPending}
                onAction={onAction}
              />
            )}
          </div>
        </div>
      </PageBody>
      {(dialog?.kind === "create" || dialog?.kind === "edit") && (
        <CategoryDialog
          open
          onOpenChange={(open) => {
            if (!open) setDialog(null);
          }}
          entries={entries}
          editing={dialog.kind === "edit" ? dialog.entry : null}
          defaultClass={cls}
          defaultParent={dialog.kind === "create" ? dialog.parent : null}
        />
      )}
      {dialog?.kind === "merge" && (
        <MergeDialog
          open
          onOpenChange={(open) => {
            if (!open) setDialog(null);
          }}
          source={dialog.entry}
          entries={entries}
        />
      )}
      {dialog?.kind === "archive" && (
        <AlertDialog open onOpenChange={closeArchive}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {t("archive.title", { name: dialog.entry.path })}
              </DialogTitle>
              <DialogDescription>{t("archive.description")}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="ghost"
                tone="secondary"
                onClick={() => {
                  setDialog(null);
                }}
              >
                {t("detail.cancel")}
              </Button>
              <Button
                tone="danger"
                loading={archive.isPending}
                onClick={() => {
                  archive
                    .mutateAsync({ id: dialog.entry.id, on: today })
                    .then(() => {
                      setDialog(null);
                    })
                    .catch((error: unknown) => {
                      setDialog(null);
                      toast.show({
                        tone: "danger",
                        title: errorText(error, t),
                      });
                    });
                }}
              >
                {t("category.archive")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </AlertDialog>
      )}
    </Page>
  );
}
