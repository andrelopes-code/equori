import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";
import { useState } from "react";

import type { CategoryEntry } from "@/features/categories";
import styles from "@/features/planning/income-split/bucket-categories.module.css";
import { BucketChecklist } from "@/features/planning/income-split/bucket-checklist";
import { BucketChooser } from "@/features/planning/income-split/bucket-chooser";
import {
  bucketCounts,
  expenseBranches,
  outsideChoice,
  outsideRoots,
} from "@/features/planning/income-split/bucket-draft";
import type { BucketDraft } from "@/features/planning/income-split/bucket-draft";
import { useT } from "@/i18n/i18n-provider";

interface BucketCategoriesProps {
  entries: readonly CategoryEntry[];
  draft: BucketDraft;
  // Starts on the categories without a bucket instead of the first bucket.
  outsideFirst: boolean;
  onChoices: (choices: Map<string, string>) => void;
}

// What goes in each bucket (income buckets spec 5): the buckets on the left, and on the right
// the categories checked for the chosen one; a category in another bucket names it.
export function BucketCategories({
  entries,
  draft,
  outsideFirst,
  onChoices,
}: BucketCategoriesProps) {
  const t = useT();
  const [chosen, setChosen] = useState<string | null>(
    outsideFirst ? outsideChoice : null,
  );
  const branches = expenseBranches(entries);
  const parents = new Map(entries.map((e) => [e.id, e.parentId]));
  const counts = bucketCounts(draft, parents, branches);
  const outside = outsideRoots(draft, branches);
  const selected =
    draft.buckets.find((b) => b.key === chosen)?.key ??
    (chosen === outsideChoice ? outsideChoice : draft.buckets[0]?.key);

  return (
    <Stack gap={3}>
      <Text size="sm" weight="medium">
        {t("buckets.section.categories")}
      </Text>
      <div className={styles.panes}>
        <BucketChooser
          buckets={draft.buckets}
          counts={counts}
          outside={outside.length}
          selected={selected}
          onSelect={setChosen}
        />
        <BucketChecklist
          draft={draft}
          branches={branches}
          parents={parents}
          outside={outside}
          selected={selected}
          onChoices={onChoices}
        />
      </div>
    </Stack>
  );
}
