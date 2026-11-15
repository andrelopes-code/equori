import { IconButton } from "@slotted/react/button";
import { Checkbox } from "@slotted/react/checkbox";
import { Glyph, Icon } from "@slotted/react/icon";
import { TextField } from "@slotted/react/text-field";

import styles from "@/features/planning/income-split/bucket-dialog.module.css";
import type { DraftBucket } from "@/features/planning/income-split/bucket-draft";
import { useT } from "@/i18n/i18n-provider";

interface BucketEditRowProps {
  bucket: DraftBucket;
  onChange: (change: Partial<DraftBucket>) => void;
  onRemove: () => void;
}

// One bucket of the dialog on one line: name, share, whether it takes the savings, remove.
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
      <Checkbox
        checked={bucket.takesSavings}
        onCheckedChange={(checked) => {
          onChange({ takesSavings: checked });
        }}
      >
        {t("buckets.field.savings")}
      </Checkbox>
      <IconButton
        size="sm"
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
