import { IconButton } from "@slotted/react/button";
import { Glyph, Icon } from "@slotted/react/icon";
import { TextField } from "@slotted/react/text-field";
import { Text } from "@slotted/react/typography";

import { bucketMeasures } from "@/features/planning/income-split/bucket-draft";
import type { DraftBucket } from "@/features/planning/income-split/bucket-draft";
import { PotBadge } from "@/features/planning/income-split/dialog/pot-badge";
import styles from "@/features/planning/income-split/dialog/split-dialog.module.css";
import { useT } from "@/i18n/i18n-provider";
import { ChoiceSelect } from "@/ui/form-fields/choice-select";

interface BucketPotRowProps {
  bucket: DraftBucket;
  // The position of the bucket in the split, from one.
  number: number;
  // The categories that draw from the bucket.
  count: number;
  onChange: (change: Partial<DraftBucket>) => void;
  onRemove: () => void;
}

// One bucket of the dialog on one line (dialog spec A249): number, name, share, how its target
// counts, its categories, remove.
export function BucketPotRow({
  bucket,
  number,
  count,
  onChange,
  onRemove,
}: BucketPotRowProps) {
  const t = useT();
  const label =
    bucket.name.trim() === "" ? t("buckets.field.name") : bucket.name;

  return (
    <div className={styles.potRow}>
      <PotBadge number={number} />
      <TextField
        aria-label={t("buckets.field.name")}
        value={bucket.name}
        maxLength={40}
        onChange={(event) => {
          onChange({ name: event.target.value });
        }}
      />
      <TextField
        className={styles.share}
        aria-label={t("buckets.field.share")}
        inputMode="decimal"
        value={bucket.share}
        end={t("buckets.share.unit")}
        onChange={(event) => {
          onChange({ share: event.target.value });
        }}
      />
      <ChoiceSelect
        label={t("buckets.field.measure", { name: label })}
        multiple={false}
        value={bucket.measure}
        choices={bucketMeasures.map((m) => ({
          value: m,
          label: t(`buckets.measure.${m}`),
        }))}
        onChange={(next) => {
          const measure = bucketMeasures.find((m) => m === next);
          if (measure !== undefined) onChange({ measure });
        }}
      />
      <Text size="sm" tone="muted" numeric="tabular" className={styles.end}>
        {String(count)}
      </Text>
      <IconButton
        variant="ghost"
        tone="secondary"
        aria-label={t("buckets.remove", { name: label })}
        onClick={onRemove}
      >
        <Icon>
          <Glyph name="trash" />
        </Icon>
      </IconButton>
    </div>
  );
}
