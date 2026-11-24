import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import {
  feedHasProblem,
  isActive,
} from "@/features/setup/market-data/feed-status";
import { MarketDataNotices } from "@/features/setup/market-data/market-data-notices";
import { MarketDataPlaceholder } from "@/features/setup/market-data/market-data-placeholder";
import { MarketDataRegions } from "@/features/setup/market-data/market-data-regions";
import { MarketDataToolbar } from "@/features/setup/market-data/market-data-toolbar";
import { meQuery } from "@/features/session";
import {
  marketDataFeedsQuery,
  useRefreshMarketData,
  useSetMarketDataFeed,
} from "@/features/setup/api";
import { SettingsSection } from "@/features/setup/settings-layout/settings-section";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { QueryError } from "@/ui/feedback/query-error";
import { regionName } from "@/ui/region/region-name";

// ADR 025 F10: one switch per feed, the latest stored date, a warning when a feed is overdue or
// failed, and one action that runs every enabled feed. The feeds stand in groups by region.
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
  const set = useSetMarketDataFeed();
  const refresh = useRefreshMarketData();

  const items = feeds.data ?? [];
  const enabled = items.filter((f) => f.enabled);
  const suggested = items.filter((f) => f.suggested);
  // ADR 025 F8: a member reads the state; only an admin changes it.
  const admin = me?.role === "admin";
  const polling =
    runsBefore !== null &&
    items.some(
      (f) => runsBefore.has(f.id) && runsBefore.get(f.id) === f.last_run,
    );
  const working = polling || enabled.some(isActive);
  const failure = set.error ?? refresh.error;

  function handleSet(id: string, on: boolean, acceptUnofficial: boolean) {
    set.mutate({ id, enabled: on, acceptUnofficial });
  }

  function handleEnableSuggested() {
    void (async () => {
      for (const f of suggested)
        await set.mutateAsync({ id: f.id, enabled: true });
    })().catch(() => undefined);
  }

  function handleRefresh() {
    const before = new Map(enabled.map((f) => [f.id, f.last_run] as const));
    refresh.mutate(undefined, {
      onSuccess: () => {
        setRunsBefore(before);
      },
    });
  }

  return (
    <SettingsSection
      topic="market_data"
      title={t("settings.market_data.title")}
      description={t("settings.summary.market_data")}
      actions={
        feeds.isSuccess && (
          <MarketDataToolbar
            admin={admin}
            working={working}
            refreshDisabled={enabled.length === 0}
            refreshing={refresh.isPending}
            onRefresh={handleRefresh}
          />
        )
      }
    >
      {feeds.isError ? (
        <QueryError error={feeds.error} onRetry={() => void feeds.refetch()} />
      ) : feeds.isPending ? (
        <MarketDataPlaceholder />
      ) : (
        <>
          <MarketDataNotices
            noneEnabled={enabled.length === 0}
            suggestion={
              admin && suggested.length > 0
                ? {
                    regionName: regionName(me.region, t, tag),
                    enabling: set.isPending,
                    onEnable: handleEnableSuggested,
                  }
                : null
            }
            attention={enabled.some(feedHasProblem)}
            polling={polling}
            failure={failure}
          />

          <MarketDataRegions
            feeds={items}
            home={me?.region}
            controls={{
              admin,
              loadingId: set.isPending ? set.variables.id : null,
              onSet: handleSet,
            }}
          />
        </>
      )}
    </SettingsSection>
  );
}
