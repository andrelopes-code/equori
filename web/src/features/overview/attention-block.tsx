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
import { OverviewBlock } from "@/features/overview/overview-block";
import { OverviewRows } from "@/features/overview/overview-rows";
import { useBase } from "@/features/overview/use-base";
import { connectionsQuery } from "@/features/connections";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { MoneyFigure } from "@/ui/money-figure";

// What waits for a decision. The block is not drawn when nothing does.
export function AttentionBlock({ limit }: { limit?: number }) {
  const t = useT();
  const api = useApi();
  const [locale] = useAppLocale();
  const { scale } = useBase();
  const accounts = useQuery(accountsQuery(api));
  const uncategorized = useQuery(uncategorizedQuery(api));
  const connections = useQuery(connectionsQuery(api));
  const open = (accounts.data ?? []).filter(
    (account) =>
      (account.class === "asset" || account.class === "liability") &&
      account.closed_on === undefined,
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
          unconfirmed: open.map((account, i) => ({
            account,
            count: unconfirmed[i]?.data?.length ?? 0,
          })),
          connections: connections.data?.items ?? [],
          differences: open.map((account, i) => ({
            account,
            difference: reconciliations[i]?.data?.open_difference?.difference,
          })),
        });
  if (!loading && error === null && items.length === 0) return null;
  const number = new Intl.NumberFormat(locale);
  const shown = limit === undefined ? items : items.slice(0, limit);
  const hidden = items.length - shown.length;
  const rows = shown.map((item) => ({
    key: `${item.kind}-${item.account?.id ?? ""}`,
    title: t(`overview.attention.${item.kind}`),
    ...(item.account === undefined ? {} : { line: item.account.name }),
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
      title={t("overview.attention.title")}
      loading={loading && error === null}
      error={error}
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
  const route = accountRoute(account);
  return account.kind === "credit_card"
    ? route
    : { ...route, search: { tab: "reconciliation" } };
}
