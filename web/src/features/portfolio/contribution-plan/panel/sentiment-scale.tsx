import { Slider } from "@slotted/react/slider";
import { Text } from "@slotted/react/typography";
import { useQuery } from "@tanstack/react-query";
import type { CSSProperties } from "react";

import { useApi } from "@/api/api-context";
import { sentimentQuery } from "@/features/portfolio/api";
import { fearGreedIndex } from "@/features/portfolio/contribution-plan/criteria/model/criteria-catalog";
import styles from "@/features/portfolio/contribution-plan/panel/sentiment-scale.module.css";
import { usePicked } from "@/features/portfolio/contribution-plan/panel/use-picked";
import { shareOfDays } from "@/features/portfolio/contribution-plan/panel/share-of-days";
import { shareText } from "@/features/portfolio/contribution-plan/model/share-text";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface SentimentScaleProps {
  // The stored limit, "" for none.
  limit: string;
  // Whether a change of the plan is being saved.
  pending: boolean;
  onLimit: (limit: string) => void;
}

const greatest = 100;

// The index from 0 to 100: where it stands today, the limit of the purchase and how often the index was
// there. The limit starts empty: none is suggested.
export function SentimentScale({
  limit,
  pending,
  onLimit,
}: SentimentScaleProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const api = useApi();
  const index = useQuery(sentimentQuery(api, fearGreedIndex)).data;
  const { value, pick } = usePicked(
    limit === "" ? undefined : Number(limit),
    pending,
  );

  const days =
    index === undefined || value === undefined
      ? undefined
      : shareOfDays(index, value);
  const style = {
    "--now": `${String(index?.value ?? 0)}%`,
  } as CSSProperties;
  const label = t("contributionPlan.index.limit");

  function handleCommit(next: number) {
    if (String(next) !== limit) onLimit(String(next));
  }

  return (
    <div className={styles.scale} style={style}>
      {index?.value !== undefined && (
        <div className={styles.marks}>
          <Text size="xs" weight="semibold" className={styles.now}>
            {t("contributionPlan.index.today", { value: String(index.value) })}
          </Text>
        </div>
      )}

      <Slider
        aria-label={label}
        aria-valuetext={
          value === undefined
            ? t("contributionPlan.index.unset")
            : t("contributionPlan.index.upTo", { value: String(value) })
        }
        min={0}
        max={greatest}
        step={1}
        value={value ?? greatest}
        valueLabel="none"
        indicator={value !== undefined}
        marks={index?.value === undefined ? [] : [index.value]}
        onValueChange={(next) => {
          if (typeof next === "number") pick(next);
        }}
        onValueCommit={(next) => {
          if (typeof next === "number") handleCommit(next);
        }}
      />

      <div className={styles.ends}>
        <Text size="xs" tone="muted">
          {t("contributionPlan.index.fear")}
        </Text>

        <Text
          size="xs"
          {...(value === undefined
            ? { weight: "semibold" as const }
            : { tone: "muted" as const })}
        >
          {value === undefined && t("contributionPlan.index.choose")}

          {value !== undefined &&
            days !== undefined &&
            t("contributionPlan.index.days", {
              value: String(value),
              share: shareText(days, locale),
            })}
        </Text>

        <Text size="xs" tone="muted">
          {t("contributionPlan.index.greed")}
        </Text>
      </div>
    </div>
  );
}
