import { Button } from "@slotted/react/button";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { useT } from "@/i18n/i18n-provider";

type ExternalRecord = components["schemas"]["ExternalRecord"];

interface GroupConfirmProps {
  record: ExternalRecord;
  busy: boolean;
  onConfirm: (transactionId: string) => void;
}

// A168, A169: the line waits with the entry it belongs to; confirming settles the whole group.
export function GroupConfirm({ record, busy, onConfirm }: GroupConfirmProps) {
  const t = useT();
  const entry = record.candidates[0];
  if (entry === undefined) return null;

  return (
    <Stack gap={3}>
      <Text size="sm" tone="muted">
        {t("batch.group.lines", {
          count: (record.group_record_ids?.length ?? 0) + 1,
        })}
      </Text>
      <Button
        loading={busy}
        onClick={() => {
          onConfirm(entry);
        }}
      >
        {t("batch.group.confirm")}
      </Button>
    </Stack>
  );
}
