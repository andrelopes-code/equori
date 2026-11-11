import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import styles from "@/features/accounts/pages/batch-page.module.css";
import { ReviewQueue } from "@/features/accounts/review/review-queue";
import { ReviewRecord } from "@/features/accounts/review/review-record";
import type { ReviewSelection } from "@/features/accounts/review/use-review-selection";
import { useT } from "@/i18n/i18n-provider";
import { BulkOutcomeNotice } from "@/ui/feedback/bulk-outcome-notice";
import { FormNotice } from "@/ui/form-layout/form-notice";

type ExternalRecord = components["schemas"]["ExternalRecord"];

interface ReviewWorkspaceProps {
  accountId: string;
  batchId: string;
  records: ExternalRecord[];
  current: ExternalRecord | undefined;
  scale: (code: string) => number;
  busy: boolean;
  selection: ReviewSelection;
  onStale: () => void;
  onResolved: () => void;
}

export function ReviewWorkspace({
  accountId,
  batchId,
  records,
  current,
  scale,
  busy,
  selection,
  onStale,
  onResolved,
}: ReviewWorkspaceProps) {
  const t = useT();

  return (
    <Stack gap={4}>
      {selection.outcome !== undefined && (
        <BulkOutcomeNotice
          outcome={selection.outcome}
          summary="bulk.resolved"
          labelOf={selection.labelOf}
        />
      )}
      {selection.error !== null && <FormNotice>{selection.error}</FormNotice>}

      <div className={styles.workspace} aria-busy={busy || undefined}>
        <ReviewQueue
          accountId={accountId}
          batchId={batchId}
          records={records}
          current={current?.id}
          scale={scale}
          selection={selection}
        />

        {current === undefined ? (
          <Text size="sm" tone="muted">
            {t("batch.choose")}
          </Text>
        ) : (
          <ReviewRecord
            key={current.id}
            record={current}
            scale={scale}
            onStale={onStale}
            onResolved={onResolved}
          />
        )}
      </div>
    </Stack>
  );
}
