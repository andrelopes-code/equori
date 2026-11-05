import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import styles from "@/features/accounts/batch-page.module.css";
import { ReviewQueue } from "@/features/accounts/review-queue";
import { ReviewRecord } from "@/features/accounts/review-record";
import { useT } from "@/i18n/i18n-provider";

type ExternalRecord = components["schemas"]["ExternalRecord"];

interface ReviewWorkspaceProps {
  accountId: string;
  batchId: string;
  records: ExternalRecord[];
  current: ExternalRecord | undefined;
  scale: (code: string) => number;
  busy: boolean;
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
  onStale,
  onResolved,
}: ReviewWorkspaceProps) {
  const t = useT();

  return (
    <div className={styles.workspace} aria-busy={busy || undefined}>
      <ReviewQueue
        accountId={accountId}
        batchId={batchId}
        records={records}
        current={current?.id}
        scale={scale}
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
  );
}
