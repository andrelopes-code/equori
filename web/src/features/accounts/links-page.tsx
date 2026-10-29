import { PageBody } from "@slotted/react/page";
import {
  ResultState,
  ResultStateContent,
  ResultStateDescription,
  ResultStateTitle,
} from "@slotted/react/result-state";
import { Skeleton } from "@slotted/react/skeleton";
import { Stack } from "@slotted/react/stack";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";

import { useApi } from "@/api/api-context";
import { compatibleKinds } from "@/features/accounts/account-kinds";
import { HeaderSlot } from "@/features/accounts/header-slot";
import { HelpLink } from "@/features/help";
import { accountsQuery, connectionsListQuery } from "@/features/accounts/api";
import { ConnectionLinks } from "@/features/accounts/connection-links";
import { linkCandidates } from "@/features/accounts/link-candidates";
import { LinkDrawer } from "@/features/accounts/link-drawer";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { QueryError } from "@/ui/query-error";
import { Presence } from "@/ui/presence";

// The accounts Open Finance connections bring, and the ledger account each one feeds (A35).
export function LinksPage() {
  const t = useT();
  const [locale] = useAppLocale();
  const api = useApi();
  const navigate = useNavigate();
  const search = useSearch({ from: "/_authed/accounts/links" });
  const connections = useQuery(connectionsListQuery(api));
  const accounts = useQuery(accountsQuery(api));
  const byId = new Map((accounts.data ?? []).map((a) => [a.id, a]));
  const items = connections.data?.items ?? [];
  const entries = items.flatMap((connection) =>
    connection.accounts.map((external) => ({ connection, external })),
  );
  const open = entries.find((entry) => entry.external.id === search.external);
  // Every ledger account another external account feeds, so it is not offered twice.
  const fed = new Set(
    items.flatMap((c) =>
      c.accounts
        .filter((a) => a.state === "mapped" && a.id !== search.external)
        .flatMap((a) => (a.account_id === undefined ? [] : [a.account_id])),
    ),
  );

  return (
    <>
      <HeaderSlot slot="subheading">{t("links.subtitle")}</HeaderSlot>
      <HeaderSlot slot="actions">
        <HelpLink page="bank-connections" />
      </HeaderSlot>
      <PageBody>
        {connections.isError ? (
          <QueryError
            error={connections.error}
            onRetry={() => void connections.refetch()}
          />
        ) : connections.isPending || accounts.isPending ? (
          <Stack gap={4} aria-busy="true">
            <Skeleton shape="text" inlineSize="30%" />
            <Skeleton shape="block" blockSize="10rem" />
          </Stack>
        ) : items.length === 0 ? (
          <ResultState status="empty" reach="section">
            <ResultStateContent>
              <ResultStateTitle>{t("links.empty")}</ResultStateTitle>
              <ResultStateDescription>
                {t("links.emptyHint")}
              </ResultStateDescription>
            </ResultStateContent>
          </ResultState>
        ) : (
          <Stack gap={8}>
            {items.map((connection) => (
              <ConnectionLinks
                key={connection.id}
                connection={connection}
                accounts={byId}
                onLink={(external) => {
                  void navigate({
                    to: "/accounts/links",
                    search: {
                      external: external.id,
                      connection: connection.id,
                    },
                  });
                }}
              />
            ))}
          </Stack>
        )}
      </PageBody>
      <Presence value={open?.external.id}>
        {(externalId) => {
          const entry = entries.find((e) => e.external.id === externalId);
          return entry === undefined ? null : (
            <LinkDrawer
              connection={entry.connection}
              external={entry.external}
              candidates={linkCandidates(
                entry.external,
                accounts.data ?? [],
                fed,
                locale,
              )}
              preselected={search.account}
              onClose={() => {
                void navigate({ to: "/accounts/links", search: {} });
              }}
              onCreate={() => {
                const kind = compatibleKinds(entry.external.subtype)[0];
                void navigate({
                  to: "/accounts/new",
                  search: {
                    ...(kind === undefined ? {} : { kind }),
                    name: entry.external.name,
                    return: "links",
                    external: entry.external.id,
                    connection: entry.connection.id,
                  },
                });
              }}
            />
          );
        }}
      </Presence>
    </>
  );
}
