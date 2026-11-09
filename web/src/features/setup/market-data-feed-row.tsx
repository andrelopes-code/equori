import { Switch } from "@slotted/react/switch";
import { useState } from "react";

import type { components } from "@/api/schema.gen";
import { feedDescription } from "@/features/setup/feed-description";
import type { MessageKey } from "@/i18n/catalog.en";
import { catalogEn } from "@/i18n/catalog.en";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { ConfirmDialog } from "@/ui/confirm-dialog";

interface MarketDataFeedRowProps {
  feed: components["schemas"]["MarketDataFeed"];
  admin: boolean;
  loading: boolean;
  onSet: (enabled: boolean, acceptUnofficial: boolean) => void;
}

export function MarketDataFeedRow({
  feed,
  admin,
  loading,
  onSet,
}: MarketDataFeedRowProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const [confirming, setConfirming] = useState(false);

  function handleCheckedChange(enabled: boolean) {
    if (enabled && !feed.official) setConfirming(true);
    else onSet(enabled, false);
  }

  function handleConfirm() {
    setConfirming(false);
    onSet(true, true);
  }

  return (
    <>
      <Switch
        labelPlacement="start"
        checked={feed.enabled}
        readOnly={!admin}
        loading={loading}
        invalid={feed.enabled && (feed.stale || feed.error !== null)}
        description={feedDescription(feed, t, tag)}
        onCheckedChange={handleCheckedChange}
      >
        {feedName(t, feed.id)}
      </Switch>

      {confirming && (
        <ConfirmDialog
          title={t("settings.feeds.unofficial.title")}
          description={t("settings.feeds.unofficial.description")}
          confirmLabel={t("settings.feeds.unofficial.confirm")}
          tone="warning"
          onConfirm={handleConfirm}
          onCancel={() => {
            setConfirming(false);
          }}
        />
      )}
    </>
  );
}

function feedName(t: ReturnType<typeof useT>, id: string): string {
  const key = `marketData.feed.${id}`;
  return key in catalogEn ? t(key as MessageKey) : id;
}
