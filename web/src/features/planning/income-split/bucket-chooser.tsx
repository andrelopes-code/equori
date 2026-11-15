import { Text } from "@slotted/react/typography";

import styles from "@/features/planning/income-split/bucket-categories.module.css";
import { outsideChoice } from "@/features/planning/income-split/bucket-draft";
import type { DraftBucket } from "@/features/planning/income-split/bucket-draft";
import { useT } from "@/i18n/i18n-provider";

interface BucketChooserProps {
  buckets: readonly DraftBucket[];
  // The categories that draw from each bucket key.
  counts: ReadonlyMap<string, number>;
  // The top-level categories without a bucket.
  outside: number;
  selected: string | undefined;
  onSelect: (key: string) => void;
}

// The buckets as toggle buttons, each with its share and how many categories it holds, and a
// last entry for the categories without a bucket. Built here: no family draws a two-line
// choice with an end value; the pressed state follows the toggle-button pattern.
export function BucketChooser({
  buckets,
  counts,
  outside,
  selected,
  onSelect,
}: BucketChooserProps) {
  const t = useT();
  const count = (n: number) =>
    n === 1 ? t("buckets.count.one") : t("buckets.count", { count: String(n) });

  return (
    <div className={styles.chooser}>
      {buckets.map((b) => (
        <button
          key={b.key}
          type="button"
          className={styles.choice}
          aria-pressed={b.key === selected}
          onClick={() => {
            onSelect(b.key);
          }}
        >
          <span className={styles.names}>
            <Text size="sm" weight="medium">
              {b.name.trim() === "" ? t("buckets.field.name") : b.name}
            </Text>
            <Text size="xs" tone="muted">
              {count(counts.get(b.key) ?? 0)}
            </Text>
          </span>
          <Text size="sm" tone="muted" numeric="tabular">
            {b.share === "" ? "0%" : `${b.share}%`}
          </Text>
        </button>
      ))}
      <button
        type="button"
        className={styles.choice}
        aria-pressed={selected === outsideChoice}
        onClick={() => {
          onSelect(outsideChoice);
        }}
      >
        <span className={styles.names}>
          <Text size="sm" weight="medium">
            {t("buckets.unplaced")}
          </Text>
          <Text
            size="xs"
            {...(outside > 0
              ? { tone: "danger" as const }
              : { tone: "muted" as const })}
          >
            {count(outside)}
          </Text>
        </span>
      </button>
    </div>
  );
}
