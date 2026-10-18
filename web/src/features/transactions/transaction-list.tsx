import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { List, ListSection } from "@slotted/react/list";
import {
  ResultState,
  ResultStateActions,
  ResultStateContent,
  ResultStateTitle,
} from "@slotted/react/result-state";
import { Skeleton, SkeletonRegion } from "@slotted/react/skeleton";
import { useEffect, useMemo, useRef } from "react";
import type { ReactNode } from "react";

import { useApi } from "@/api/api-context";
import { accountsQuery } from "@/features/accounts";
import {
  instrumentsQuery,
  payeesQuery,
  settingsQuery,
  useScale,
} from "@/features/setup";
import { transactionsInfiniteQuery } from "@/features/transactions/api";
import { PlaceholderRows } from "@/features/transactions/placeholder-rows";
import type { TransactionSearch } from "@/features/transactions/search";
import { TransactionDayList } from "@/features/transactions/transaction-day-list";
import styles from "@/features/transactions/transaction-list.module.css";
import { transactionRow } from "@/features/transactions/transaction-row";
import { TransactionTable } from "@/features/transactions/transaction-table";
import { occurrencesQuery, schedulesQuery } from "@/features/planning";
import { upcomingRows } from "@/features/transactions/upcoming-row";
import { shiftDate } from "@/i18n/format";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { QueryError } from "@/ui/query-error";
import { useViewport } from "@/ui/use-viewport";

const placeholderRows = 5;
const prefetchMargin = "200px";

export function TransactionList({
  search,
  limit,
  infinite,
  brief = false,
  onSelect,
  selected,
  emptyActions,
}: {
  search: TransactionSearch;
  limit?: number;
  infinite: boolean;
  // Drops the Category column of the table (ledger sheet L17).
  brief?: boolean;
  // A table row opens beside the table instead of the transaction page.
  onSelect?: (id: string) => void;
  selected?: string;
  emptyActions?: ReactNode;
}) {
  const t = useT();
  const api = useApi();
  const scale = useScale();
  const viewport = useViewport();
  const accounts = useQuery(accountsQuery(api));
  const settings = useQuery(settingsQuery(api));
  const today = useToday();
  // Complete frontend T4: the next 31 days of schedules stand above an unfiltered list.
  const showUpcoming = infinite && Object.keys(search).length === 0;
  const occurrences = useQuery({
    ...occurrencesQuery(api, shiftDate(today, 1), shiftDate(today, 31)),
    enabled: showUpcoming,
  });
  const schedules = useQuery({ ...schedulesQuery(api), enabled: showUpcoming });
  const instruments = useQuery(instrumentsQuery(api));
  // Payee names refine the row labels but never block the list.
  const payees = useQuery(payeesQuery(api));
  const transactions = useInfiniteQuery(
    transactionsInfiniteQuery(api, {
      ...search,
      ...(limit === undefined ? {} : { limit }),
    }),
  );
  const payeeNames = useMemo(
    () => new Map(payees.data?.map((p) => [p.id, p.name])),
    [payees.data],
  );
  const accountsById = useMemo(
    () => new Map(accounts.data?.map((a) => [a.id, a])),
    [accounts.data],
  );

  const sentinel = useRef<HTMLDivElement>(null);
  const {
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    fetchNextPage,
  } = transactions;
  const ready =
    accounts.data !== undefined &&
    transactions.data !== undefined &&
    scale !== null;
  useEffect(() => {
    const node = sentinel.current;
    if (
      !infinite ||
      !ready ||
      !hasNextPage ||
      isFetchingNextPage ||
      isFetchNextPageError ||
      !node
    ) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void fetchNextPage();
        }
      },
      { rootMargin: prefetchMargin },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [
    infinite,
    ready,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    fetchNextPage,
  ]);

  // A failed next page keeps the loaded rows; the list end offers the retry.
  const failed =
    accounts.error ??
    instruments.error ??
    (isFetchNextPageError ? null : transactions.error);
  if (failed) {
    return (
      <QueryError
        error={failed}
        onRetry={() => {
          void accounts.refetch();
          void instruments.refetch();
          void transactions.refetch();
        }}
      />
    );
  }
  if (
    accounts.data === undefined ||
    transactions.data === undefined ||
    scale === null
  ) {
    if (viewport === "desktop") {
      return (
        <SkeletonRegion>
          <TransactionTable
            rows={[]}
            brief={brief}
            baseCurrency={undefined}
            scale={() => 0}
            loading
            loadingMore={false}
          />
        </SkeletonRegion>
      );
    }
    return (
      <SkeletonRegion>
        <List
          variant="ruled"
          aria-label={t("transactions.list")}
          aria-hidden="true"
        >
          {/* The grouped list reserves its first day heading, so the rows do not move down on arrival. */}
          {infinite ? (
            <ListSection
              label={<Skeleton shape="text" inlineSize="6rem" />}
              level="2"
              sticky
            >
              <PlaceholderRows count={placeholderRows} />
            </ListSection>
          ) : (
            <PlaceholderRows count={Math.min(limit ?? 50, placeholderRows)} />
          )}
        </List>
      </SkeletonRegion>
    );
  }

  const pages = transactions.data.pages.flatMap((page) => page.items);
  if (pages.length === 0) {
    const filtered = Object.keys(search).length > 0;
    return (
      <ResultState status={filtered ? "no-results" : "empty"} reach="section">
        <ResultStateContent>
          <ResultStateTitle>
            {t(filtered ? "transactions.noresults" : "transactions.empty")}
          </ResultStateTitle>
        </ResultStateContent>
        {emptyActions !== undefined && (
          <ResultStateActions>{emptyActions}</ResultStateActions>
        )}
      </ResultState>
    );
  }
  const rows = pages.map((tx) =>
    transactionRow(tx, accountsById, payeeNames, search.account_id),
  );
  const upcoming =
    showUpcoming &&
    occurrences.data !== undefined &&
    schedules.data !== undefined
      ? upcomingRows(
          occurrences.data,
          schedules.data,
          new Map(accounts.data.map((a) => [a.id, a.name])),
          today,
        )
      : [];
  return (
    <>
      {viewport === "desktop" ? (
        <TransactionTable
          rows={rows}
          brief={brief}
          baseCurrency={settings.data?.base_currency}
          scale={scale}
          loading={false}
          loadingMore={isFetchingNextPage}
          upcoming={upcoming}
          {...(onSelect === undefined ? {} : { onSelect })}
          {...(selected === undefined ? {} : { selected })}
        />
      ) : (
        <TransactionDayList
          rows={rows}
          grouped={infinite}
          upcoming={upcoming}
          scale={scale}
          loadingMore={isFetchingNextPage}
        />
      )}
      {isFetchNextPageError && (
        <QueryError
          error={transactions.error}
          onRetry={() => {
            void fetchNextPage();
          }}
        />
      )}
      {infinite && hasNextPage && !isFetchNextPageError && (
        <div ref={sentinel} className={styles.sentinel} aria-hidden="true" />
      )}
    </>
  );
}
