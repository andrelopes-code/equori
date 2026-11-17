import { Inline } from "@slotted/react/inline";
import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import type { CategoryEntry } from "@/features/categories";
import type { VersionChange } from "@/features/planning/income-split/bucket-version-changes";
import { useShareText } from "@/features/planning/income-split/use-share-text";
import { useT } from "@/i18n/i18n-provider";

type Bucket = components["schemas"]["BudgetBucket"];

interface BucketVersionRowProps {
  // A bucket of the version; absent on a row that states one change on its own.
  bucket?: Bucket;
  // The changes of the version: a bucket row reads its own, a change row reads `change`.
  changes?: readonly VersionChange[];
  // The change a row without a bucket states; absent states that nothing changed.
  change?: VersionChange;
  categories: readonly CategoryEntry[];
}

const noteKinds = ["share", "added", "renamed", "measure"] as const;

// One line of a version: a bucket with its share and what changed in it, or one change in
// muted text.
export function BucketVersionRow({
  bucket,
  changes = [],
  change,
  categories,
}: BucketVersionRowProps) {
  const t = useT();
  const share = useShareText();

  const own = noteKinds
    .map((kind) =>
      changes.find((c) => c.kind === kind && "id" in c && c.id === bucket?.id),
    )
    .find((c) => c !== undefined);
  const category = (id: string) =>
    categories.find((c) => c.id === id)?.name ??
    t("track.entries.uncategorized");
  const side = (name: string | undefined) => name ?? t("buckets.outside");

  function text(c: VersionChange | undefined): string {
    switch (c?.kind) {
      case "share":
        return t("buckets.change.was", { share: share(c.before) });
      case "added":
        return t("buckets.change.new");
      case "renamed":
        return t("buckets.change.renamed", { name: c.before });
      case "measure":
        return t("buckets.change.measure");
      case "removed":
        return t("buckets.change.removed", { name: c.name });
      case "moved":
        return t("buckets.change.moved", {
          category: category(c.categoryId),
          before: side(c.before),
          after: side(c.after),
        });
      case "ended":
        return t("buckets.change.ended");
      case "started":
        return t("buckets.change.started");
      default:
        return t("buckets.change.none");
    }
  }

  if (bucket === undefined)
    return (
      <Text size="sm" tone="muted" truncate>
        {text(change)}
      </Text>
    );

  return (
    <Inline gap={4} align="center" justify="between" wrap="nowrap">
      <Inline gap={4} align="center" wrap="nowrap">
        <Text size="sm" weight="medium" truncate>
          {bucket.name}
        </Text>
        {own !== undefined && (
          <Text size="sm" tone="muted" truncate>
            {text(own)}
          </Text>
        )}
      </Inline>
      <Text size="sm" numeric="tabular">
        {share(bucket.share_bp)}
      </Text>
    </Inline>
  );
}
