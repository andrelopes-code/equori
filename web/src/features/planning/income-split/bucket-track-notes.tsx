import { Button } from "@slotted/react/button";
import { Inline } from "@slotted/react/inline";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

import { useT } from "@/i18n/i18n-provider";

interface BucketTrackNotesProps {
  // The spending outside the split, the retained yields and the unallocated income of the month.
  outside: number;
  retained: number;
  unallocated: number;
  // The name of the month on screen.
  month: string;
  money: (amount: number) => string;
  onOutside: () => void;
}

// The sentences under the buckets of the Track view: what was spent outside the split, the
// yields that stayed in the investments (A252) and the unallocated income, an accrual figure
// (A235), one per line. Each is drawn only when its amount is not zero.
export function BucketTrackNotes({
  outside,
  retained,
  unallocated,
  month,
  money,
  onOutside,
}: BucketTrackNotesProps) {
  const t = useT();

  if (outside <= 0 && retained <= 0 && unallocated === 0) return null;

  return (
    <Stack gap={1}>
      {outside > 0 && (
        <Inline align="center" gap={3}>
          <Text size="sm" tone="muted">
            {t("track.outside", { amount: money(outside), month })}
          </Text>
          <Button
            size="sm"
            variant="ghost"
            tone="secondary"
            onClick={onOutside}
          >
            {t("track.entries.see")}
          </Button>
        </Inline>
      )}

      {retained > 0 && (
        <Text size="sm" tone="muted">
          {t("track.retained", { amount: money(retained) })}
        </Text>
      )}

      {unallocated > 0 && (
        <Text size="sm" tone="muted">
          {t("track.unallocated", { amount: money(unallocated), month })}
        </Text>
      )}

      {unallocated < 0 && (
        <Text size="sm" tone="muted">
          {t("track.unallocatedNegative", {
            amount: money(-unallocated),
            month,
          })}
        </Text>
      )}
    </Stack>
  );
}
