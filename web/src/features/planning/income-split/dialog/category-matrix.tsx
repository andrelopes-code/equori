import { Text } from "@slotted/react/typography";
import { useState } from "react";
import type { CSSProperties } from "react";

import type { CategoryEntry } from "@/features/categories";
import {
  expenseBranches,
  outsideRoots,
} from "@/features/planning/income-split/bucket-draft";
import type { BucketDraft } from "@/features/planning/income-split/bucket-draft";
import { MatrixHead } from "@/features/planning/income-split/dialog/matrix-head";
import { MatrixLegend } from "@/features/planning/income-split/dialog/matrix-legend";
import { MatrixLine } from "@/features/planning/income-split/dialog/matrix-line";
import {
  matrixRows,
  pickChoice,
} from "@/features/planning/income-split/dialog/matrix-rows";
import styles from "@/features/planning/income-split/dialog/split-dialog.module.css";
import { useT } from "@/i18n/i18n-provider";

// Above this number of buckets a column shows the number of the bucket without its name.
const namedColumns = 6;

interface CategoryMatrixProps {
  entries: readonly CategoryEntry[];
  draft: BucketDraft;
  onChoices: (choices: Map<string, string>) => void;
}

// The bucket of each expense category (dialog spec A250): a row per category, a column per
// bucket, one mark per row.
export function CategoryMatrix({
  entries,
  draft,
  onChoices,
}: CategoryMatrixProps) {
  const t = useT();
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());

  const branches = expenseBranches(entries);
  const parents = new Map(entries.map((e) => [e.id, e.parentId]));
  const rows = matrixRows(draft, branches, parents, open);
  const outside = outsideRoots(draft, branches).length;
  const outsideText =
    outside === 1
      ? t("buckets.unplaced.one")
      : t("buckets.unplaced.many", { count: String(outside) });

  function handleToggle(id: string) {
    const next = new Set(open);
    if (!next.delete(id)) next.add(id);
    setOpen(next);
  }

  return (
    <section className={styles.block}>
      <div className={styles.blockHead}>
        <Text size="sm" weight="medium">
          {t("buckets.section.categories")}
        </Text>
        {outside === 0 && (
          <Text size="sm" tone="muted">
            {t("buckets.noneOutside")}
          </Text>
        )}
        {outside > 0 && (
          <Text size="sm" tone="danger" weight="medium">
            {outsideText}
          </Text>
        )}
      </div>

      <div
        className={styles.matrix}
        data-dense={draft.buckets.length > namedColumns ? "" : undefined}
        style={{ "--cols": draft.buckets.length } as CSSProperties}
        role="group"
        aria-label={t("buckets.matrix.label")}
      >
        <MatrixHead buckets={draft.buckets} />
        {rows.map((row) => (
          <MatrixLine
            key={row.entry.id}
            row={row}
            buckets={draft.buckets}
            onPick={(column) => {
              onChoices(pickChoice(draft, parents, row.entry.id, column));
            }}
            onToggle={() => {
              handleToggle(row.entry.id);
            }}
          />
        ))}
      </div>

      <MatrixLegend />
    </section>
  );
}
