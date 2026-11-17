import { Text } from "@slotted/react/typography";

import type { DraftBucket } from "@/features/planning/income-split/bucket-draft";
import { sumState } from "@/features/planning/income-split/dialog/split-bar";
import { useShareText } from "@/features/planning/income-split/use-share-text";
import { useT } from "@/i18n/i18n-provider";

interface BucketSumProps {
  buckets: readonly DraftBucket[];
}

// The sum of the shares in words (dialog spec A249): distributed, or what is missing or over.
export function BucketSum({ buckets }: BucketSumProps) {
  const t = useT();
  const shareText = useShareText(0);
  const sum = sumState(buckets);

  if (sum.kind === "whole")
    return (
      <Text size="sm" tone="muted" numeric="tabular">
        {t("buckets.sum.whole", { total: shareText(10_000) })}
      </Text>
    );

  if (sum.kind === "invalid")
    return (
      <Text size="sm" tone="danger" weight="medium">
        {t("buckets.sum.invalid")}
      </Text>
    );

  return (
    <Text size="sm" tone="danger" weight="medium" numeric="tabular">
      {t(`buckets.sum.${sum.kind}`, {
        total: shareText(sum.total),
        off: shareText(sum.off),
      })}
    </Text>
  );
}
