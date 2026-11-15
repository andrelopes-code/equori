import { Text } from "@slotted/react/typography";

import type { CategoryEntry } from "@/features/categories/model/category-paths";
import type { Placement } from "@/features/planning";
import { useT } from "@/i18n/i18n-provider";

interface TreeBucketCellProps {
  entry: CategoryEntry;
  placement: Placement | undefined;
}

// The bucket an expense category draws from: its own, its parent's in the muted tone, or the
// words "Outside the split". An income category has none.
export function TreeBucketCell({ entry, placement }: TreeBucketCellProps) {
  const t = useT();
  if (entry.class !== "expense" || entry.uncategorized) return null;

  if (placement === undefined)
    return (
      <Text size="sm" tone="muted">
        {t("buckets.outside")}
      </Text>
    );

  return (
    <Text
      size="sm"
      {...(placement.inherited ? { tone: "muted" as const } : {})}
    >
      {placement.inherited
        ? t("buckets.inherited", { name: placement.name })
        : placement.name}
    </Text>
  );
}
