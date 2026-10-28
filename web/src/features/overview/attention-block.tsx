import { useQueries, useQuery } from "@tanstack/react-query";
import type { NavigateOptions } from "@tanstack/react-router";

import { useApi } from "@/api/api-context";
import {
  accountRoute,
  accountsQuery,
  reconciliationQuery,
  unconfirmedQuery,
} from "@/features/accounts";
import { uncategorizedQuery } from "@/features/overview/api";
import { attentionItems } from "@/features/overview/attention";
import type { AttentionItem } from "@/features/overview/attention";
import {
  OverviewBlock,
  type Placement,
} from "@/features/overview/overview-block";
import { OverviewRows } from "@/features/overview/overview-rows";
import { useBase } from "@/features/overview/use-base";
import { connectionsQuery } from "@/features/connections";
import { numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { MoneyFigure } from "@/ui/money-figure";

// What waits for a decision. The block is not drawn when nothing does.
export function AttentionBlock({
  limit,
  ...placement
}: { limit?: number } & Placement) {
  const t = useT();
  const api = useApi();
  const [locale] = useAppLocale();
  const { scale } = useBase();
  const accounts = useQuery(accountsQuery(api));
  const uncategorized = useQuery(uncategorizedQuery(api));
  const connections = useQuery(connectionsQuery(api));
  const all = accounts.data ?? [];
  // An account with sub-accounts holds no records: the API refuses its unconfirmed list.
  const parents = new Set(all.map((account) => account.parent_id));
  const open = all.filter(
    (account) =>
      (account.class === "asset" || account.class === "liability") &&
      account.closed_on === undefined &&
      !parents.has(account.id),
  );
  const unconfirmed = useQueries({
    queries: open.map((account) => unconfirmedQuery(api, account.id)),
  });
  const reconciliations = useQueries({
    queries: open.map((account) => reconciliationQuery(api, account.id)),
  });
  const sources = [
    accounts,
    uncategorized,
    connections,
    ...unconfirmed,
    ...reconciliations,
  ];
  const error = sources.find((query) => query.error !== null)?.error ?? null;
  const loading =
    scale === null || sources.some((query) => query.data === undefined);
  const items =
    loading || error !== null
      ? []
      : attentionItems({
          uncategorized: uncategorized.data?.count ?? 0,
          unconfirmed: open.map((account, i) => {
            // Entries come oldest first; a card's earliest one names the statement to open.
            const statementId = unconfirmed[i]?.data?.find(
              (entry) => entry.statement_id !== undefined,
            )?.statement_id;
            return {
              account,
              count: unconfirmed[i]?.data?.length ?? 0,
              ...(statementId === undefined ? {} : { statementId }),
            };
          }),
          connections: connections.data?.items ?? [],
          differences: open.map((account, i) => ({
            account,
            difference: reconciliations[i]?.data?.open_difference?.difference,
          })),
        });
  const number = numberFormatter(locale);
  const shown = limit === undefined ? items : items.slice(0, limit);
  const hidden = items.length - shown.length;
  const rows = shown.map((item) => ({
    key: `${item.kind}-${item.account?.id ?? ""}`,
    title: t(`overview.attention.${item.kind}`),
    ...(item.account === undefined
      ? {}
      : {
          line:
            item.unconfirmed === undefined
              ? item.account.name
              : t("overview.attention.withUnconfirmed", {
                  account: item.account.name,
                  count: number.format(item.unconfirmed),
                }),
        }),
    end:
      item.difference !== undefined && scale !== null ? (
        <MoneyFigure
          amount={item.difference.amount}
          currency={item.difference.currency}
          scale={scale(item.difference.currency)}
        />
      ) : item.kind === "uncategorized" && uncategorized.data?.more === true ? (
        t("overview.attention.atLeast", {
          count: number.format(item.count),
        })
      ) : (
        number.format(item.count)
      ),
    to: destination(item),
  }));
  if (hidden > 0)
    rows.push({
      key: "more",
      title: t("overview.attention.more", { count: hidden }),
    } as (typeof rows)[number]);
  return (
    <OverviewBlock
      placement={placement}
      loading={loading && error === null}
      error={error}
      // The widget keeps its cell when nothing needs attention, so the grid holds no hole.
      empty={items.length === 0 ? t("overview.attention.empty") : undefined}
      onRetry={() => {
        for (const query of sources) {
          if (query.isError) void query.refetch();
        }
      }}
    >
      <OverviewRows label={t("overview.attention.title")} rows={rows} />
    </OverviewBlock>
  );
}

function destination(item: AttentionItem): NavigateOptions {
  if (item.kind === "uncategorized")
    return { to: "/transactions", search: { uncategorized: true } };
  if (item.kind === "connections") return { to: "/accounts/links" };
  const account = item.account;
  if (account === undefined) return { to: "/accounts" };
  if (item.kind === "unconfirmed" && item.statementId !== undefined)
    return {
      to: "/cards/$accountId/statements/$statementId",
      params: { accountId: account.id, statementId: item.statementId },
    };
  const route = accountRoute(account);
  return account.kind === "credit_card"
    ? route
    : { ...route, search: { tab: "reconciliation" } };
}
