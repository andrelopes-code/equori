import { Switch } from "@slotted/react/switch";
import { Text } from "@slotted/react/typography";
import { useId, useState } from "react";

import type { components } from "@/api/schema.gen";
import type { FeedControls } from "@/features/setup/market-data/feed-controls";
import { FeedMark } from "@/features/setup/market-data/feed-mark";
import {
  feedFullName,
  feedName,
} from "@/features/setup/market-data/feed-names";
import { feedRowText } from "@/features/setup/market-data/feed-row-text";
import {
  feedHasProblem,
  feedStatus,
} from "@/features/setup/market-data/feed-status";
import styles from "@/features/setup/market-data/market-data.module.css";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { ConfirmDialog } from "@/ui/dialogs/confirm-dialog";
import { TitleTag } from "@/ui/display/title-tag";

interface MarketDataFeedRowProps {
  feed: components["schemas"]["MarketDataFeed"];
  controls: FeedControls;
}

const statusTone = {
  ok: "muted",
  muted: "muted",
  warning: "warning",
  danger: "danger",
} as const;

// Families read: switch, list-item, tag. A switch draws its label and its control on one line; the
// row has a status column between them, so the row is the page's own and the switch is named and
// described through the ids of its parts.
export function MarketDataFeedRow({ feed, controls }: MarketDataFeedRowProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const [confirming, setConfirming] = useState(false);
  const id = useId();
  const name = feedName(t, feed.id);
  const fullName = feedFullName(t, feed.id);
  const text = feedRowText(feed, t, tag);
  const status = feedStatus(feed);
  const working = feed.enabled && feed.activity !== "idle";
  const running = feed.enabled && feed.activity === "running";
  const describedBy = [`${id}-line`, `${id}-status`]
    .concat(text.issue === null ? [] : [`${id}-issue`])
    .join(" ");

  function handleCheckedChange(enabled: boolean) {
    if (enabled && !feed.official) setConfirming(true);
    else controls.onSet(feed.id, enabled, false);
  }

  function handleConfirm() {
    setConfirming(false);
    controls.onSet(feed.id, true, true);
  }

  return (
    <div
      className={styles.row}
      data-issue={text.issue === null ? undefined : ""}
      aria-busy={running || undefined}
    >
      <div className={styles.main}>
        <div className={styles.name}>
          <Text size="md" weight="medium" className={styles.nameText}>
            {name}
          </Text>
          {!feed.official && (
            <TitleTag>{t("settings.feeds.unofficial.tag")}</TitleTag>
          )}
        </div>

        <Text size="sm" tone="muted" className={styles.line} id={`${id}-line`}>
          {text.detail}
          {text.coverage !== null && (
            <span className={styles.coverageWide}>{text.coverage}</span>
          )}
        </Text>

        {text.issue !== null && (
          <Text
            size="sm"
            tone={text.issue.tone}
            className={styles.line}
            id={`${id}-issue`}
          >
            {text.issue.text}
          </Text>
        )}
      </div>

      <div className={styles.status} id={`${id}-status`}>
        {text.coverage !== null && (
          <Text size="sm" tone="muted" className={styles.coverageNarrow}>
            {text.coverage}
          </Text>
        )}

        <Text size="sm" weight="medium" className={styles.date}>
          {feed.last !== null && formatDate(feed.last, tag)}
          {feed.last === null &&
            t(working ? "marketData.firstLoad" : "marketData.noDate")}
        </Text>

        <Text size="sm" tone={statusTone[status.tone]} className={styles.word}>
          {t(`marketData.status.${status.word}`)}
        </Text>
      </div>

      <FeedMark tone={status.tone} running={running} />

      <Switch
        className={styles.toggle}
        aria-label={fullName}
        aria-describedby={describedBy}
        checked={controls.asked.get(feed.id) ?? feed.enabled}
        readOnly={!controls.admin}
        invalid={feedHasProblem(feed)}
        onCheckedChange={handleCheckedChange}
      />

      {confirming && (
        <ConfirmDialog
          title={t("settings.feeds.unofficial.title")}
          description={t(
            feed.kind === "index"
              ? "settings.feeds.unofficial.indexDescription"
              : "settings.feeds.unofficial.description",
          )}
          confirmLabel={t("settings.feeds.unofficial.confirm")}
          tone="warning"
          onConfirm={handleConfirm}
          onCancel={() => {
            setConfirming(false);
          }}
        />
      )}
    </div>
  );
}
