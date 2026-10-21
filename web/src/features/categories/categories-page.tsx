import { parseISOYearMonth, toISOYearMonth } from "@slotted/core/date";
import {
  AlertDialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@slotted/react/dialog";
import { Button } from "@slotted/react/button";
import { DatePicker } from "@slotted/react/date-picker";
import { Glyph, Icon } from "@slotted/react/icon";
import { Inline } from "@slotted/react/inline";
import { Page, PageBody } from "@slotted/react/page";
import { Segment, SegmentedControl } from "@slotted/react/segmented-control";
import { Switch } from "@slotted/react/switch";
import { toast } from "@slotted/react/toast";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { useApi } from "@/api/api-context";
import { errorText } from "@/api/problem";
import { accountsQuery } from "@/features/accounts";
import {
  categoryTotalsQuery,
  useArchiveCategory,
  useReopenCategory,
} from "@/features/categories/api";
import { CategoriesHeader } from "@/features/categories/categories-header";
import { validateCategoriesSearch } from "@/features/categories/categories-search";
import styles from "@/features/categories/categories-page.module.css";
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
import { settingsQuery, useScale } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";

type Dialog =
  | { kind: "create"; parent: string | null }
  | { kind: "edit"; entry: CategoryEntry }
  | { kind: "merge"; entry: CategoryEntry }
  | { kind: "archive"; entry: CategoryEntry };

function monthBounds(month: string): { from: string; to: string } {
  const [year = 0, mon = 1] = month.split("-").map(Number);
  const last = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  return {
    from: `${month}-01`,
    to: `${month}-${String(last).padStart(2, "0")}`,
  };
}

export function CategoriesPage() {
  const t = useT();

  const api = useApi();
  const today = useToday();
  const navigate = useNavigate({ from: "/categories" });
  const search = useSearch({ from: "/_authed/categories" });
  const month = search.month ?? today.slice(0, 7);
  const cls: CategoryClass = search.class ?? "expense";
  const showArchived = search.archived === true;
  const { from, to } = monthBounds(month);

  const accounts = useQuery(accountsQuery(api));
  const settings = useQuery(settingsQuery(api));
  const totals = useQuery(categoryTotalsQuery(api, from, to, cls));
  const scale = useScale();
  const archive = useArchiveCategory();
  const reopen = useReopenCategory();
  const [dialog, setDialog] = useState<Dialog | null>(null);

  const entries = useCategoryEntries(accounts.data);
  const currency = settings.data?.base_currency ?? "BRL";

  const rows = useMemo((): TreeRow[] => {
    const byId = new Map(
      (totals.data ?? []).map((item) => [item.account_id, item]),
    );
    const sign = cls === "income" ? -1 : 1;
    // The system accounts — fees, interest, taxes — stand in the tree only in a month that
    // touched them; the uncategorized holder always does.
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
      .reduce(
        (sum, e) => sum + sign * (byId.get(e.id)?.subtree_total.amount ?? 0),
        0,
      );
    return shown.map((entry) => {
      const item = byId.get(entry.id);
      const subtree = sign * (item?.subtree_total.amount ?? 0);
      return {
        id: entry.id,
        parentId:
          entry.parentId !== undefined && visible.has(entry.parentId)
            ? entry.parentId
            : null,
        entry,
        own: sign * (item?.total.amount ?? 0),
        subtree,
        share: classTotal > 0 ? subtree / classTotal : 0,
      };
    });
  }, [entries, totals.data, cls, showArchived]);

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

  return (
    <Page width="wide" fill>
      <CategoriesHeader
        current="categories"
        actions={
          <Button
            start={
              <Icon size="sm">
                <Glyph name="plus" />
              </Icon>
            }
            onClick={() => {
              setDialog({ kind: "create", parent: null });
            }}
          >
            {t("category.new")}
          </Button>
        }
      />
      <PageBody>
        <div className={styles.region}>
          <Inline gap={4} justify="between" align="center">
            <Inline gap={4} align="center">
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
              <div className={styles.month}>
                <DatePicker
                  aria-label={t("category.month")}
                  granularity="month"
                  value={parseISOYearMonth(month)}
                  onValueChange={(next) => {
                    if (
                      next !== null &&
                      !Array.isArray(next) &&
                      "month" in next
                    ) {
                      setSearch({ month: toISOYearMonth(next) });
                    }
                  }}
                />
              </div>
            </Inline>
            <Switch
              checked={showArchived}
              onCheckedChange={(checked) => {
                setSearch({ archived: checked ? true : undefined });
              }}
            >
              {t("category.showArchived")}
            </Switch>
          </Inline>
          <div className={styles.listing}>
            {scale !== null && (
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
        <AlertDialog
          open
          onOpenChange={(open) => {
            if (!open) setDialog(null);
          }}
        >
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
