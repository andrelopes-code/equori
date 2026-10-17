import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { List, ListSection } from "@slotted/react/list";
import {
  ListItem,
  ListItemBody,
  ListItemDescription,
  ListItemEnd,
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
import { Skeleton } from "@slotted/react/skeleton";
import { useEffect, useMemo, useRef } from "react";
import type { ReactNode } from "react";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { accountsQuery } from "@/features/accounts";
import { useScale } from "@/features/setup";
import { transactionsInfiniteQuery } from "@/features/transactions/api";
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

function PlaceholderRows({ count }: { count: number }) {
  return Array.from({ length: count }, (_, i) => (
    <ListItem key={i}>
      <ListItemBody>
        <ListItemLabel>
          <Skeleton shape="text" inlineSize="60%" />
        </ListItemLabel>
        <ListItemDescription>
          <Skeleton shape="text" inlineSize="40%" />
        </ListItemDescription>
      </ListItemBody>
    </ListItem>
  ));
}

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
  const transactions = useInfiniteQuery(
    transactionsInfiniteQuery(api, {
      ...search,
      ...(limit === undefined ? {} : { limit }),
    }),
  );
  const accountsById = useMemo(
    () => new Map(accounts.data?.map((a) => [a.id, a])),
    [accounts.data],
  );

  const sentinel = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = transactions;
  const ready = accounts.data !== undefined && transactions.data !== undefined;
  useEffect(() => {
    const node = sentinel.current;
    if (!infinite || !ready || !hasNextPage || isFetchingNextPage || !node) {
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
  }, [infinite, ready, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const failed = accounts.error ?? transactions.error;
  if (failed) {
    return (
      <QueryError
        error={failed}
        onRetry={() => {
          void accounts.refetch();
          void transactions.refetch();
        }}
      />
    );
  }
  if (accounts.data === undefined || transactions.data === undefined) {
    return (
      <List aria-busy="true" aria-label={t("transactions.list")} loading>
        <PlaceholderRows count={Math.min(limit ?? 50, placeholderRows)} />
      </List>
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
    const label = tx.description || categories;
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
            <ListItemLabel
              className={tx.voided_at === undefined ? "" : styles.voided}
            >
              {label === "" ? t("transactions.untitled") : label}
              {tx.description !== "" && categories !== "" && (
                <span className={styles.category}>{categorySuffix}</span>
              )}
            </ListItemLabel>
            <ListItemDescription>{second}</ListItemDescription>
          </ListItemBody>
          <ListItemEnd>
            <MoneyText
              money={money}
              scale={scale(money.currency)}
              tone="flow"
            />
          </ListItemEnd>
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
                level="3"
                sticky
              >
                {items.map(renderRow)}
              </ListSection>
            ))
          : rows.map(renderRow)}
        {isFetchingNextPage && <PlaceholderRows count={placeholderRows} />}
      </List>
      {infinite && hasNextPage && (
        <div ref={sentinel} className={styles.sentinel} aria-hidden="true" />
      )}
    </>
  );
}
