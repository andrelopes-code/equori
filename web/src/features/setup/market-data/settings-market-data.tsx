import { Button } from "@slotted/react/button";
import {
  Alert,
  AlertActions,
  AlertContent,
  AlertDescription,
} from "@slotted/react/alert";
import { Inline } from "@slotted/react/inline";
import { Loader } from "@slotted/react/progress-indicator";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import { errorText } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { meQuery } from "@/features/session";
import {
  marketDataFeedsQuery,
  useRefreshMarketData,
  useSetMarketDataFeed,
} from "@/features/setup/api";
import { MarketDataFeedRow } from "@/features/setup/market-data/market-data-feed-row";
import { MarketDataPlaceholder } from "@/features/setup/market-data/market-data-placeholder";
import { SettingsGroup } from "@/features/setup/settings-layout/settings-group";
import { SettingsSection } from "@/features/setup/settings-layout/settings-section";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { QueryError } from "@/ui/feedback/query-error";

type Feed = components["schemas"]["MarketDataFeed"];

// ADR 025 F10: one switch per feed, the latest stored date, a warning when a feed is overdue or
// failed, and one action that runs every enabled feed.
export function SettingsMarketData() {
  const t = useT();
  const api = useApi();
  const [tag] = useAppLocale();
  const [runsBefore, setRunsBefore] = useState<ReadonlyMap<
    string,
    string | null
  > | null>(null);
  const feeds = useQuery(marketDataFeedsQuery(api, runsBefore));
  const me = useQuery(meQuery(api)).data;
  const region = me?.region;
  // ADR 025 F8: a member reads the state; only an admin changes it.
  const admin = me?.role === "admin";
  const set = useSetMarketDataFeed();
  const refresh = useRefreshMarketData();

  const rows = (kind: Feed["kind"]) =>
    (feeds.data ?? [])
      .filter((f) => f.kind === kind)
      .map((f) => (
        <MarketDataFeedRow
          key={f.id}
          feed={f}
          admin={admin}
          loading={set.isPending && set.variables.id === f.id}
          onSet={(enabled, acceptUnofficial) => {
            set.mutate({ id: f.id, enabled, acceptUnofficial });
          }}
        />
      ));

  const items = feeds.data ?? [];
  const enabled = items.filter((f) => f.enabled);
  const suggested = items.filter((f) => f.suggested);
  const attention = enabled.some((f) => f.stale || f.error !== null);
  const polling =
    runsBefore !== null &&
    items.some(
      (f) => runsBefore.has(f.id) && runsBefore.get(f.id) === f.last_run,
    );
  const working = polling || enabled.some((f) => f.history_pending > 0);
  const failure = set.error ?? refresh.error;
  const regionName =
    region === undefined
      ? ""
      : (new Intl.DisplayNames([tag], { type: "region" }).of(region) ?? region);

  return (
    <SettingsSection
      topic="market_data"
      title={t("settings.market_data.title")}
      description={t("settings.summary.market_data")}
    >
      {feeds.isError ? (
        <QueryError error={feeds.error} onRetry={() => void feeds.refetch()} />
      ) : feeds.isPending ? (
        <MarketDataPlaceholder />
      ) : (
        <>
          {enabled.length === 0 && (
            <Alert tone="info">
              <AlertContent>
                <AlertDescription>{t("marketData.none")}</AlertDescription>
              </AlertContent>
              {admin && suggested.length > 0 && (
                <AlertActions>
                  <Button
                    loading={set.isPending}
                    onClick={() => {
                      void (async () => {
                        for (const f of suggested)
                          await set.mutateAsync({
                            id: f.id,
                            enabled: true,
                          });
                      })().catch(() => undefined);
                    }}
                  >
                    {t("marketData.suggest", { region: regionName })}
                  </Button>
                </AlertActions>
              )}
            </Alert>
          )}
          {attention && (
            <Alert tone="warning">
              <AlertContent>
                <AlertDescription>{t("marketData.attention")}</AlertDescription>
              </AlertContent>
            </Alert>
          )}
          {polling && (
            <Alert tone="info" live="polite">
              <AlertContent>
                <AlertDescription>
                  {t("marketData.refreshing")}
                </AlertDescription>
              </AlertContent>
            </Alert>
          )}
          {failure !== null && (
            <Alert tone="danger" live="polite">
              <AlertContent>
                <AlertDescription>{errorText(failure, t)}</AlertDescription>
              </AlertContent>
            </Alert>
          )}

          <SettingsGroup
            title={t("marketData.prices")}
            actions={
              (admin || working) && (
                <Inline gap={3} align="center">
                  {working && (
                    <Loader size="sm" aria-label={t("marketData.working")} />
                  )}
                  {admin && (
                    <Button
                      variant="outline"
                      tone="secondary"
                      disabled={enabled.length === 0}
                      loading={refresh.isPending}
                      onClick={() => {
                        const before = new Map(
                          enabled.map((f) => [f.id, f.last_run] as const),
                        );
                        refresh.mutate(undefined, {
                          onSuccess: () => {
                            setRunsBefore(before);
                          },
                        });
                      }}
                    >
                      {t("marketData.refresh")}
                    </Button>
                  )}
                </Inline>
              )
            }
          >
            {rows("price")}
          </SettingsGroup>
          <SettingsGroup title={t("marketData.indexes")}>
            {rows("index")}
            {rows("expectation")}
          </SettingsGroup>
        </>
      )}
    </SettingsSection>
  );
}
