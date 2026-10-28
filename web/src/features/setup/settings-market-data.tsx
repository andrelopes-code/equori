import { Button } from "@slotted/react/button";
import { Alert, AlertContent, AlertDescription } from "@slotted/react/alert";
import { SkeletonText } from "@slotted/react/skeleton";
import { Switch } from "@slotted/react/switch";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { AlertActions } from "@/ui/alert-actions";
import { useApi } from "@/api/api-context";
import { errorText } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { meQuery } from "@/features/session";
import {
  marketDataFeedsQuery,
  useRefreshMarketData,
  useSetMarketDataFeed,
} from "@/features/setup/api";
import { SettingsGroup } from "@/features/setup/settings-group";
import { SettingsSection } from "@/features/setup/settings-section";
import type { MessageKey } from "@/i18n/catalog.en";
import { catalogEn } from "@/i18n/catalog.en";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { QueryError } from "@/ui/query-error";

type Feed = components["schemas"]["MarketDataFeed"];

function feedName(t: ReturnType<typeof useT>, id: string): string {
  const key = `marketData.feed.${id}`;
  return key in catalogEn ? t(key as MessageKey) : id;
}

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

  const describe = (f: Feed): string => {
    if (f.error !== null) return t("marketData.failed", { error: f.error });
    if (f.last === null) return t("marketData.never");
    const date = formatDate(f.last, tag);
    return f.stale
      ? t("marketData.stale", { date })
      : t("marketData.last", { date });
  };

  const rows = (kind: Feed["kind"]) =>
    (feeds.data ?? [])
      .filter((f) => f.kind === kind)
      .map((f) => (
        <Switch
          key={f.id}
          labelPlacement="start"
          checked={f.enabled}
          readOnly={!admin}
          loading={set.isPending && set.variables.id === f.id}
          invalid={f.enabled && (f.stale || f.error !== null)}
          description={describe(f)}
          onCheckedChange={(enabled) => {
            set.mutate({ id: f.id, enabled });
          }}
        >
          {feedName(t, f.id)}
        </Switch>
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
        <SettingsGroup>
          <SkeletonText lines={4} />
        </SettingsGroup>
      ) : (
        <>
          {enabled.length === 0 && (
            <Alert tone="info">
              <AlertContent>
                <AlertDescription>{t("marketData.none")}</AlertDescription>
              </AlertContent>
              {admin && suggested.length > 0 && (
                <AlertActions tone="info">
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
              admin && (
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
