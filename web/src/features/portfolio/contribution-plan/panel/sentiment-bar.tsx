import type { CSSProperties } from "react";

import styles from "@/features/portfolio/contribution-plan/panel/sentiment-scale.module.css";
import { useT } from "@/i18n/i18n-provider";

interface SentimentBarProps {
  // The index, 0 to 100; undefined without a value.
  today: number | undefined;
  // The limit; undefined without one.
  limit: number | undefined;
}

// Build-own-element: where the index stands against the limit, on one line. No family marks two values
// on a scale.
export function SentimentBar({ today, limit }: SentimentBarProps) {
  const t = useT();

  const style = {
    "--pct": `${String(limit ?? 0)}%`,
    "--now": `${String(today ?? 0)}%`,
  } as CSSProperties;

  return (
    <span
      role="img"
      className={styles.mini}
      style={style}
      aria-label={t("contributionPlan.index.label", {
        today: today === undefined ? "–" : String(today),
        limit: limit === undefined ? "–" : String(limit),
      })}
    >
      <span className={styles.zone} />

      {today !== undefined && <span className={styles.today} />}
    </span>
  );
}
