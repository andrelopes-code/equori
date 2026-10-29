import { Button } from "@slotted/react/button";

import { useReopenRecord } from "@/features/accounts/api";
import { useT } from "@/i18n/i18n-provider";

export interface ReopenRecordButtonProps {
  recordId: string;
}

// A140: a discarded line returns to review, with the entries the ledger holds now.
export function ReopenRecordButton({ recordId }: ReopenRecordButtonProps) {
  const t = useT();
  const reopen = useReopenRecord();

  return (
    <Button
      size="sm"
      variant="ghost"
      tone="secondary"
      loading={reopen.isPending}
      onClick={() => {
        reopen.mutate(recordId);
      }}
    >
      {t("batch.reopen")}
    </Button>
  );
}
