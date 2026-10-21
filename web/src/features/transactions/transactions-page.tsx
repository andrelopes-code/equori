import { Glyph, Icon } from "@slotted/react/icon";
import { Button, IconButton } from "@slotted/react/button";
import { Page, PageBody, PageFooter } from "@slotted/react/page";
import {
  PageHeader,
  PageHeaderActions,
  PageHeaderArea,
  PageHeaderContent,
  PageHeaderHeading,
  PageHeaderSubheading,
  PageHeaderTabs,
  PageHeaderTitle,
  PageHeaderTitleArea,
  PageHeaderTitleRow,
} from "@slotted/react/page-header";
import { Tab, TabList, Tabs } from "@slotted/react/tabs";
import { toast } from "@slotted/react/toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useDeferredValue, useMemo, useState } from "react";

import { useApi } from "@/api/api-context";
import { errorText } from "@/api/problem";
import { accountsQuery } from "@/features/accounts";
import { useCategoryEntries } from "@/features/categories";
import { payeesQuery, useScale } from "@/features/setup";
import {
  tagsQuery,
  transactionKeys,
  uncategorizedCountQuery,
} from "@/features/transactions/api";
import { validateTransactionSearch } from "@/features/transactions/search";
import type { TransactionSearchDraft } from "@/features/transactions/search";
import { PeriodControl } from "@/features/transactions/period-control";
import { PeriodSummary } from "@/features/transactions/period-summary";
import { SelectionBar } from "@/features/transactions/selection-bar";
import { TransactionFilters } from "@/features/transactions/transaction-filters";
import { TransactionDetail } from "@/features/transactions/transaction-detail";
import { TransactionsEmpty } from "@/features/transactions/transactions-empty";
import { TransactionsGrid } from "@/features/transactions/transactions-grid";
import styles from "@/features/transactions/transactions-page.module.css";
import { useCategorizeActions } from "@/features/transactions/use-categorize-actions";
import { usePeriodTotals } from "@/features/transactions/use-period-totals";
import { useTransactionList } from "@/features/transactions/use-transaction-list";
import { useT } from "@/i18n/i18n-provider";
import { compactQuery, useMediaQuery, wideQuery } from "@/ui/use-media-query";

const listID = "transactions-list";

export function TransactionsPage() {
  const t = useT();

  const api = useApi();
  const queryClient = useQueryClient();
  const navigate = useNavigate({ from: "/transactions" });
  const pageSearch = useSearch({ from: "/_authed/transactions" });
  // The selected row is the panel's; the list reads the filters alone.
  const search = useMemo(
    () => validateTransactionSearch(pageSearch),
    [pageSearch],
  );
  // The tab and the bar paint at once; the grid follows from the deferred search (CP-09).
  const shown = useDeferredValue(search);
  const list = useTransactionList(shown);
  const periodTotals = usePeriodTotals(shown);
  const accounts = useQuery(accountsQuery(api));
  const payees = useQuery(payeesQuery(api));
  const tags = useQuery(tagsQuery(api));
  const uncategorized = useQuery(uncategorizedCountQuery(api));
  const scale = useScale();
  const compact = useMediaQuery(compactQuery);
  const wide = useMediaQuery(wideQuery);
  // The pane opens beside the list on a desktop; narrower, the record is its own page.
  const selected = wide ? pageSearch.selected : undefined;
  const closePane = () => {
    void navigate({ search: search, replace: true });
  };
  const [selection, setSelection] = useState<readonly string[]>([]);
  const [picking, setPicking] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  const categories = useCategoryEntries(accounts.data);
  const categoriesById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );
  const accountsById = useMemo(
    () => new Map((accounts.data ?? []).map((a) => [a.id, a])),
    [accounts.data],
  );
  const actions = useCategorizeActions(accountsById);

  const selectedRows = list.rows.filter((row) => selection.includes(row.id));
  const selectedAmount = selectedRows.reduce(
    (sum, row) => sum + row.money.amount,
    0,
  );

  const categorizeSelection = async (categoryId: string) => {
    const category = categoriesById.get(categoryId);
    if (category === undefined) return;
    setBulkBusy(true);
    try {
      await actions.categorizeMany(
        selectedRows.map((row) => row.transaction),
        category,
      );
      setSelection([]);
    } catch (error) {
      toast.show({ tone: "danger", title: errorText(error, t) });
    } finally {
      setBulkBusy(false);
    }
  };

  const setSearch = (next: TransactionSearchDraft) => {
    setSelection([]);
    void navigate({
      search: validateTransactionSearch({ ...next }),
      replace: next.q !== search.q,
    });
  };

  const queue = search.uncategorized === true;
  const filtered = Object.keys(search).some((key) => key !== "uncategorized");
  const queueLabel =
    uncategorized.data === undefined
      ? t("transactions.tab.uncategorized")
      : t("transactions.tab.uncategorizedCount", {
          count: uncategorized.data.more
            ? `${String(uncategorized.data.count)}+`
            : uncategorized.data.count,
        });

  return (
    <Page
      width="full"
      fill
      footer={
        selection.length > 0 ? (
          <PageFooter>
            <SelectionBar
              count={selection.length}
              amount={selectedAmount}
              busy={bulkBusy}
              open={picking}
              onOpenChange={setPicking}
              onClear={() => {
                setSelection([]);
              }}
              onCategorize={(id) => {
                void categorizeSelection(id);
              }}
            />
          </PageFooter>
        ) : undefined
      }
    >
      <PageHeader size="lg">
        <PageHeaderTitleArea>
          <PageHeaderTitleRow>
            <PageHeaderTitle>
              <PageHeaderHeading>{t("nav.transactions")}</PageHeaderHeading>
              <PageHeaderSubheading>
                {t("transactions.subtitle")}
              </PageHeaderSubheading>
            </PageHeaderTitle>
            <PageHeaderActions>
              <PeriodControl
                value={
                  search.from !== undefined && search.to !== undefined
                    ? { from: search.from, to: search.to }
                    : undefined
                }
                onChange={(period) => {
                  setSearch({
                    ...search,
                    from: period?.from,
                    to: period?.to,
                  });
                }}
              />
              <IconButton
                aria-label={t("transactions.refresh")}
                variant="ghost"
                tone="secondary"
                loading={list.refreshing}
                onClick={() => {
                  void queryClient.invalidateQueries({
                    queryKey: transactionKeys.all,
                  });
                }}
              >
                <Icon>
                  <Glyph name="rotate-ccw" />
                </Icon>
              </IconButton>
              {!compact && (
                <Button
                  start={
                    <Icon size="sm">
                      <Glyph name="plus" />
                    </Icon>
                  }
                  onClick={() => {
                    void navigate({ to: "/transactions/new" });
                  }}
                >
                  {t("nav.new")}
                </Button>
              )}
            </PageHeaderActions>
          </PageHeaderTitleRow>
        </PageHeaderTitleArea>
        {periodTotals.totals !== null && scale !== null && (
          <PageHeaderArea>
            <PageHeaderContent>
              <PeriodSummary totals={periodTotals.totals} scale={scale} />
            </PageHeaderContent>
          </PageHeaderArea>
        )}
        <PageHeaderTabs>
          <Tabs
            value={queue ? "queue" : "all"}
            onValueChange={(tab) => {
              setSearch({
                ...search,
                ...(tab === "queue"
                  ? { uncategorized: true as const }
                  : { uncategorized: undefined }),
              });
            }}
          >
            <TabList aria-label={t("nav.transactions")}>
              <Tab value="all" controls={listID}>
                {t("transactions.tab.all")}
              </Tab>
              <Tab value="queue" controls={listID}>
                {queueLabel}
              </Tab>
            </TabList>
          </Tabs>
        </PageHeaderTabs>
      </PageHeader>
      <PageBody id={listID}>
        <div className={styles.region} aria-busy={shown !== search}>
          <TransactionFilters
            search={search}
            onSearchChange={setSearch}
            accounts={accounts.data ?? []}
            categories={categories}
            payees={payees.data ?? []}
            tags={tags.data ?? []}
            count={list.pending ? undefined : list.rows.length}
            hasMore={list.hasMore}
            loading={list.pending}
          />
          <div
            className={styles.listing}
            data-pane={selected === undefined ? undefined : ""}
          >
            {scale !== null && (
              <TransactionsGrid
                list={list}
                categories={categoriesById}
                scale={scale}
                height={compact ? undefined : "100%"}
                selection={selection}
                onSelectionChange={setSelection}
                onCategoryCommit={async (row, categoryId) => {
                  const category = categoriesById.get(categoryId);
                  if (category === undefined) return;
                  try {
                    await actions.categorizeOne(row.transaction, category);
                  } catch (error) {
                    throw new Error(errorText(error, t), { cause: error });
                  }
                }}
                onCategorizeSelection={() => {
                  setPicking(true);
                }}
                onOpen={(id) => {
                  if (wide) {
                    void navigate({
                      search: { ...search, selected: id },
                      replace: pageSearch.selected !== undefined,
                    });
                  } else {
                    void navigate({ to: "/transactions/$id", params: { id } });
                  }
                }}
                empty={(status) => (
                  <TransactionsEmpty
                    status={status}
                    onRetry={list.retry}
                    filtered={filtered}
                    queue={queue}
                    onClear={() => {
                      setSearch(queue ? { uncategorized: true } : {});
                    }}
                  />
                )}
              />
            )}
            {selected !== undefined && (
              <div
                className={styles.pane}
                onKeyDown={(event) => {
                  if (event.key === "Escape" && !event.defaultPrevented) {
                    closePane();
                  }
                }}
              >
                <TransactionDetail
                  key={selected}
                  id={selected}
                  host="pane"
                  onClose={closePane}
                />
              </div>
            )}
          </div>
        </div>
      </PageBody>
    </Page>
  );
}
