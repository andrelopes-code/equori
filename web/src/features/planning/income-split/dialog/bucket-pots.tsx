import { Button } from "@slotted/react/button";
import { Glyph, Icon } from "@slotted/react/icon";
import { Text } from "@slotted/react/typography";

import type { CategoryEntry } from "@/features/categories";
import {
  bucketCounts,
  expenseBranches,
  maxBuckets,
} from "@/features/planning/income-split/bucket-draft";
import type {
  BucketDraft,
  DraftBucket,
  PresetName,
} from "@/features/planning/income-split/bucket-draft";
import { BucketModelMenu } from "@/features/planning/income-split/dialog/bucket-model-menu";
import { BucketPotRow } from "@/features/planning/income-split/dialog/bucket-pot-row";
import { BucketSum } from "@/features/planning/income-split/dialog/bucket-sum";
import { splitBar } from "@/features/planning/income-split/dialog/split-bar";
import { SplitBarStrip } from "@/features/planning/income-split/dialog/split-bar-strip";
import styles from "@/features/planning/income-split/dialog/split-dialog.module.css";
import { useShareText } from "@/features/planning/income-split/use-share-text";
import { useT } from "@/i18n/i18n-provider";

interface BucketPotsProps {
  draft: BucketDraft;
  entries: readonly CategoryEntry[];
  onChange: (key: string, change: Partial<DraftBucket>) => void;
  onRemove: (key: string) => void;
  onAdd: () => void;
  onPreset: (name: PresetName) => void;
}

// The buckets of the draft (dialog spec A249): the sum, the bar, a row per bucket, and the
// button that adds one up to ten.
export function BucketPots({
  draft,
  entries,
  onChange,
  onRemove,
  onAdd,
  onPreset,
}: BucketPotsProps) {
  const t = useT();
  const shareText = useShareText(0);

  const branches = expenseBranches(entries);
  const parents = new Map(entries.map((e) => [e.id, e.parentId]));
  const counts = bucketCounts(draft, parents, branches);
  const bar = splitBar(draft.buckets);
  const barLabel = bar.segments
    .map((s, i) => `${draft.buckets[i]?.name ?? ""} ${shareText(s.bp)}`)
    .join(", ");
  const full = draft.buckets.length >= maxBuckets;

  return (
    <section className={styles.block}>
      <div className={styles.blockHead}>
        <Text size="sm" weight="medium">
          {t("buckets.section.buckets")}
        </Text>
        <BucketSum buckets={draft.buckets} />
        <span className={styles.blockAction}>
          <BucketModelMenu onPreset={onPreset} />
        </span>
      </div>

      <SplitBarStrip bar={bar} label={barLabel} />

      <div className={styles.potTable}>
        <div className={styles.potHead}>
          <span />
          <Text size="xs" tone="muted">
            {t("buckets.col.bucket")}
          </Text>
          <Text size="xs" tone="muted">
            {t("buckets.col.share")}
          </Text>
          <Text size="xs" tone="muted">
            {t("buckets.col.measure")}
          </Text>
          <Text size="xs" tone="muted" className={styles.end}>
            {t("buckets.col.categories")}
          </Text>
          <span />
        </div>

        {draft.buckets.map((b, i) => (
          <BucketPotRow
            key={b.key}
            bucket={b}
            number={i + 1}
            count={counts.get(b.key) ?? 0}
            onChange={(change) => {
              onChange(b.key, change);
            }}
            onRemove={() => {
              onRemove(b.key);
            }}
          />
        ))}
      </div>

      <div className={styles.potAdd}>
        <Button
          size="sm"
          variant="outline"
          tone="secondary"
          disabled={full}
          onClick={onAdd}
        >
          <Icon>
            <Glyph name="plus" />
          </Icon>
          {t("buckets.add")}
        </Button>
        {full && (
          <Text size="xs" tone="muted">
            {t("buckets.limit", { count: String(maxBuckets) })}
          </Text>
        )}
      </div>
    </section>
  );
}
