import { Button } from "@slotted/react/button";
import { Inline } from "@slotted/react/inline";
import { Text } from "@slotted/react/typography";

import { useT } from "@/i18n/i18n-provider";

interface PlanBucketsOutsideProps {
  // The number of open expense categories in no bucket of the month's split (A236).
  count: number;
  onPlace: () => void;
}

// The notice of the categories outside the split, with the action that places them. Draws
// nothing when every category has a bucket.
export function PlanBucketsOutside({
  count,
  onPlace,
}: PlanBucketsOutsideProps) {
  const t = useT();
  if (count === 0) return null;

  return (
    <Inline align="center" gap={3}>
      <Text size="sm" tone="muted">
        {count === 1
          ? t("buckets.outsideOne")
          : t("buckets.outsideMany", { count: String(count) })}
      </Text>
      <Button size="sm" variant="ghost" tone="secondary" onClick={onPlace}>
        {t("buckets.outsideAction")}
      </Button>
    </Inline>
  );
}
