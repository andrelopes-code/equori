import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { List, ListSection } from "@slotted/react/list";
import {
  ListItem,
  ListItemBody,
  ListItemDescription,
  ListItemLabel,
  ListItemLink,
  ListItemStart,
} from "@slotted/react/list-item";
import {
  ResultState,
  ResultStateActions,
  ResultStateContent,
  ResultStateTitle,
} from "@slotted/react/result-state";
import { SkeletonRegion } from "@slotted/react/skeleton";
import { useEffect, useMemo, useRef } from "react";
import type { ReactNode } from "react";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { accountsQuery } from "@/features/accounts";
import { instrumentsQuery, payeesQuery, useScale } from "@/features/setup";
import { transactionsInfiniteQuery } from "@/features/transactions/api";
import { PlaceholderRows } from "@/features/transactions/placeholder-rows";
import { rowAmount } from "@/features/transactions/row-amount";
import type { TransactionSearch } from "@/features/transactions/search";
import styles from "@/features/transactions/transaction-list.module.css";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { IconGlyph } from "@/ui/icon-glyph";
import { MoneyText } from "@/ui/money-text";
import { QueryError } from "@/ui/query-error";
import { useSpaLink } from "@/ui/use-spa-link";

type Account = components["schemas"]["Account"];
type Transaction = components["schemas"]["Transaction"];

const placeholderRows = 5;
const prefetchMargin = "200px";

function names(
  tx: Transaction,
  accountsById: Map<string, Account>,
  classes: readonly Account["class"][],
): string[] {
  return tx.postings.flatMap((p) => {
    const account = accountsById.get(p.account_id);
    return account !== undefined && classes.includes(account.class)
      ? [account.name]
      : [];
  });
}

// The API returns newest first, so equal dates are adjacent, across page boundaries too.
function groupByDate(
  rows: Transaction[],
): { date: string; items: Transaction[] }[] {
  const days: { date: string; items: Transaction[] }[] = [];
  for (const tx of rows) {
    const last = days.at(-1);
    if (last?.date === tx.date) last.items.push(tx);
    else days.push({ date: tx.date, items: [tx] });
  }
  return days;
}

export function TransactionList({
  search,
  limit,
  infinite,
  emptyActions,
}: {
  search: TransactionSearch;
  limit?: number;
  infinite: boolean;
  emptyActions?: ReactNode;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const api = useApi();
  const scale = useScale();
  const spaLink = useSpaLink();
  const accounts = useQuery(accountsQuery(api));
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
    return (
      <SkeletonRegion>
        <List aria-label={t("transactions.list")} aria-hidden="true">
          <PlaceholderRows count={Math.min(limit ?? 50, placeholderRows)} />
        </List>
      </SkeletonRegion>
    );
  }

  const rows = transactions.data.pages.flatMap((page) => page.items);
  if (rows.length === 0) {
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
  const renderRow = (tx: Transaction) => {
    const { money, transfer } = rowAmount(tx, accountsById, search.account_id);
    const categories = names(tx, accountsById, ["income", "expense"]).join(
      ", ",
    );
    const payee =
      tx.payee_id === undefined ? undefined : payeeNames.get(tx.payee_id);
    const label = payee ?? (tx.description || categories);
    const categorySuffix = ` · ${categories}`;
    const second = [
      ...(infinite ? [] : [formatDate(tx.date, locale)]),
      ...names(tx, accountsById, ["asset", "liability"]),
      ...tx.tags,
    ].join(" · ");
    return (
      <ListItem key={tx.id}>
        <ListItemLink {...spaLink(`/transactions/${tx.id}`)}>
          {transfer && (
            <ListItemStart>
              <IconGlyph name="transfer" />
            </ListItemStart>
          )}
          <ListItemBody>
            <ListItemLabel>
              <span data-own="transaction-line" className={styles.line}>
                <span
                  className={[
                    styles.title,
                    tx.voided_at === undefined ? "" : styles.voided,
                  ]
                    .join(" ")
                    .trim()}
                >
                  {label === "" ? t("transactions.untitled") : label}
                  {label !== categories && categories !== "" && (
                    <span className={styles.category}>{categorySuffix}</span>
                  )}
                </span>
                <span className={styles.amount}>
                  <MoneyText
                    money={money}
                    scale={scale(money.currency)}
                    tone="flow"
                  />
                </span>
              </span>
            </ListItemLabel>
            <ListItemDescription>{second}</ListItemDescription>
          </ListItemBody>
        </ListItemLink>
      </ListItem>
    );
  };
  const days = infinite ? groupByDate(rows) : [];
  return (
    <>
      <List
        variant="ruled"
        aria-label={t("transactions.list")}
        loading={isFetchingNextPage}
      >
        {infinite
          ? days.map(({ date, items }) => (
              <ListSection
                key={date}
                label={formatDate(date, locale)}
                level="2"
                sticky
              >
                {items.map(renderRow)}
              </ListSection>
            ))
          : rows.map(renderRow)}
        {isFetchingNextPage && <PlaceholderRows count={placeholderRows} />}
      </List>
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
