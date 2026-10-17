import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Button } from "@slotted/react/button";
import { List } from "@slotted/react/list";
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
  ResultStateContent,
  ResultStateTitle,
} from "@slotted/react/result-state";
import { Skeleton } from "@slotted/react/skeleton";
import { useMemo } from "react";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { accountsQuery } from "@/features/accounts";
import { useScale } from "@/features/setup";
import { transactionsInfiniteQuery } from "@/features/transactions/api";
import type { TransactionSearch } from "@/features/transactions/api";
import { rowAmount } from "@/features/transactions/row-amount";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { IconGlyph } from "@/ui/icon-glyph";
import { MoneyText } from "@/ui/money-text";
import { QueryError } from "@/ui/query-error";
import { useSpaLink } from "@/ui/use-spa-link";

type Account = components["schemas"]["Account"];
type Transaction = components["schemas"]["Transaction"];

const placeholderRows = 5;

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

export function TransactionList({
  search,
  limit,
  infinite,
}: {
  search: TransactionSearch;
  limit?: number;
  infinite: boolean;
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
        {Array.from(
          { length: Math.min(limit ?? 50, placeholderRows) },
          (_, i) => (
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
          ),
        )}
      </List>
    );
  }

  const rows = transactions.data.pages.flatMap((page) => page.items);
  if (rows.length === 0) {
    return (
      <ResultState status="empty" reach="section">
        <ResultStateContent>
          <ResultStateTitle>{t("transactions.empty")}</ResultStateTitle>
        </ResultStateContent>
      </ResultState>
    );
  }
  return (
    <>
      <List variant="ruled" aria-label={t("transactions.list")}>
        {rows.map((tx) => {
          const { money, transfer } = rowAmount(
            tx,
            accountsById,
            search.account_id,
          );
          const categories = names(tx, accountsById, ["income", "expense"]);
          const label = tx.description || categories.join(", ");
          const second = [
            formatDate(tx.date, locale),
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
                    {label === "" ? t("transactions.untitled") : label}
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
        })}
      </List>
      {infinite && transactions.hasNextPage && (
        <Button
          variant="outline"
          loading={transactions.isFetchingNextPage}
          onClick={() => {
            void transactions.fetchNextPage();
          }}
        >
          {t("transactions.more")}
        </Button>
      )}
    </>
  );
}
