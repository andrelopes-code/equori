import { Glyph, Icon } from "@slotted/react/icon";
import { Text } from "@slotted/react/typography";
import { useId } from "react";
import type { CSSProperties } from "react";

import { outsideChoice } from "@/features/planning/income-split/bucket-draft";
import type { DraftBucket } from "@/features/planning/income-split/bucket-draft";
import { MatrixCell } from "@/features/planning/income-split/dialog/matrix-cell";
import type { MatrixRow } from "@/features/planning/income-split/dialog/matrix-rows";
import styles from "@/features/planning/income-split/dialog/split-dialog.module.css";
import { useT } from "@/i18n/i18n-provider";

interface MatrixLineProps {
  row: MatrixRow;
  buckets: readonly DraftBucket[];
  // A bucket key, or outsideChoice.
  onPick: (column: string) => void;
  onToggle: () => void;
}

// One category of the matrix (dialog spec A250): its name, which opens its subcategories,
// and a radio per bucket.
export function MatrixLine({
  row,
  buckets,
  onPick,
  onToggle,
}: MatrixLineProps) {
  const t = useT();
  const group = useId();

  const name = row.entry.name;
  const top = row.depth === 0;
  const opens = top && row.subcategories > 0;
  const bucketName = (b: DraftBucket) =>
    b.name.trim() === "" ? t("buckets.field.name") : b.name;
  const moreLabel = (count: number, bucket: string) =>
    count === 1
      ? t("buckets.matrix.more.one", { name: bucket })
      : t("buckets.matrix.more", { count: String(count), name: bucket });

  // The same element in the control that opens the row and in a row that opens nothing.
  const label = (
    <Text
      size="sm"
      className={styles.mLabel}
      {...(top ? { weight: "medium" as const } : {})}
    >
      {name}
    </Text>
  );

  return (
    <div
      className={styles.mRow}
      role="radiogroup"
      aria-label={name}
      data-depth={row.depth}
      style={{ "--depth": row.depth } as CSSProperties}
    >
      {opens && (
        <button
          type="button"
          className={styles.mName}
          aria-expanded={row.open}
          aria-label={t("buckets.matrix.open", { name })}
          onClick={onToggle}
        >
          <span className={styles.twist}>
            <Icon>
              <Glyph name={row.open ? "chevron-down" : "chevron-right"} />
            </Icon>
          </span>
          {label}
        </button>
      )}
      {!opens && (
        <span className={styles.mName}>
          {top && <span className={styles.twist} />}
          {label}
        </span>
      )}

      {buckets.map((b, i) => (
        <MatrixCell
          key={b.key}
          group={group}
          label={bucketName(b)}
          number={i + 1}
          checked={row.at === b.key}
          follows={row.follows}
          more={row.more.get(b.key) ?? 0}
          moreLabel={moreLabel(row.more.get(b.key) ?? 0, bucketName(b))}
          onPick={() => {
            onPick(b.key);
          }}
        />
      ))}
      {row.canOutside && (
        <MatrixCell
          group={group}
          label={t("buckets.unplaced")}
          checked={row.at === outsideChoice}
          follows={row.follows}
          more={0}
          moreLabel=""
          onPick={() => {
            onPick(outsideChoice);
          }}
        />
      )}
      {!row.canOutside && <span className={styles.cell} data-none="" />}
    </div>
  );
}
