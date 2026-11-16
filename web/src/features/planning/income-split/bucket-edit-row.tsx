import { IconButton } from "@slotted/react/button";
import { Glyph, Icon } from "@slotted/react/icon";
import { TextField } from "@slotted/react/text-field";

import styles from "@/features/planning/income-split/bucket-dialog.module.css";
import { bucketMeasures } from "@/features/planning/income-split/bucket-draft";
import type { DraftBucket } from "@/features/planning/income-split/bucket-draft";
import { useT } from "@/i18n/i18n-provider";
import { ChoiceSelect } from "@/ui/form-fields/choice-select";

interface BucketEditRowProps {
  bucket: DraftBucket;
  onChange: (change: Partial<DraftBucket>) => void;
  onRemove: () => void;
}

// One bucket of the dialog on one line: name, share, how it counts its target, remove.
export function BucketEditRow({
  bucket,
  onChange,
  onRemove,
}: BucketEditRowProps) {
  const t = useT();
  const label =
    bucket.name.trim() === "" ? t("buckets.field.name") : bucket.name;

  return (
    <div className={styles.bucketRow}>
      <TextField
        aria-label={t("buckets.field.name")}
        value={bucket.name}
        maxLength={40}
        onChange={(event) => {
          onChange({ name: event.target.value });
        }}
      />
      <TextField
        aria-label={t("buckets.field.share")}
        inputMode="decimal"
        value={bucket.share}
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
      <IconButton
        variant="ghost"
        tone="danger"
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
