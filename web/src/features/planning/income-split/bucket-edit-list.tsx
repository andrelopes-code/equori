import { Button } from "@slotted/react/button";
import { Glyph, Icon } from "@slotted/react/icon";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

import { BucketEditRow } from "@/features/planning/income-split/bucket-edit-row";
import {
  maxBuckets,
  totalBp,
} from "@/features/planning/income-split/bucket-draft";
import type { DraftBucket } from "@/features/planning/income-split/bucket-draft";
import { useShareText } from "@/features/planning/income-split/use-share-text";
import { useT } from "@/i18n/i18n-provider";

interface BucketEditListProps {
  buckets: readonly DraftBucket[];
  onChange: (key: string, change: Partial<DraftBucket>) => void;
  onRemove: (key: string) => void;
  onAdd: () => void;
}

// The buckets of the draft, the button that adds one up to ten, and the total of the shares,
// in the danger tone while it differs from 100% (income buckets A229).
export function BucketEditList({
  buckets,
  onChange,
  onRemove,
  onAdd,
}: BucketEditListProps) {
  const t = useT();
  const shareText = useShareText();
  const total = totalBp(buckets);
  const whole = total === 10_000;
  const totalText = total === undefined ? t("plan.dash") : shareText(total);

  return (
    <Stack gap={3}>
      <Text size="sm" weight="medium">
        {t("buckets.section.buckets")}
      </Text>
      {buckets.map((b) => (
        <BucketEditRow
          key={b.key}
          bucket={b}
          onChange={(change) => {
            onChange(b.key, change);
          }}
          onRemove={() => {
            onRemove(b.key);
          }}
        />
      ))}
      <div>
        <Button
          size="sm"
          variant="outline"
          tone="secondary"
          disabled={buckets.length >= maxBuckets}
          onClick={onAdd}
        >
          <Icon>
            <Glyph name="plus" />
          </Icon>
          {t("buckets.add")}
        </Button>
      </div>
      {whole && (
        <Text size="sm" tone="muted">
          {t("buckets.total", { total: totalText })}
        </Text>
      )}
      {!whole && (
        <Text size="sm" tone="danger">
          {t("buckets.totalWrong", { total: totalText })}
        </Text>
      )}
    </Stack>
  );
}
