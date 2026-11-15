import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

import type { CategoryEntry } from "@/features/categories";
import { BucketCategoryRow } from "@/features/planning/income-split/bucket-category-row";
import {
  expenseBranches,
  outsideChoice,
  sameChoice,
} from "@/features/planning/income-split/bucket-draft";
import type { DraftBucket } from "@/features/planning/income-split/bucket-draft";
import { useT } from "@/i18n/i18n-provider";

interface BucketCategoriesProps {
  entries: readonly CategoryEntry[];
  buckets: readonly DraftBucket[];
  choices: ReadonlyMap<string, string>;
  onChoose: (categoryId: string, choice: string) => void;
}

// The bucket of each top-level expense category, with its subcategories behind a disclosure.
export function BucketCategories({
  entries,
  buckets,
  choices,
  onChoose,
}: BucketCategoriesProps) {
  const t = useT();
  const options = buckets
    .filter((b) => b.name.trim() !== "")
    .map((b) => ({ value: b.key, label: b.name }));

  return (
    <Stack gap={3}>
      <Stack gap={1}>
        <Text size="sm" weight="medium">
          {t("buckets.section.categories")}
        </Text>
        <Text size="sm" tone="muted">
          {t("buckets.categories.hint")}
        </Text>
      </Stack>
      {expenseBranches(entries).map((branch) => (
        <BucketCategoryRow
          key={branch.root.id}
          root={branch.root}
          subcategories={branch.subcategories}
          buckets={options}
          choices={choices}
          outside={outsideChoice}
          same={sameChoice}
          onChoose={onChoose}
        />
      ))}
    </Stack>
  );
}
