import { Text } from "@slotted/react/typography";

import {
  cellStatus,
  type TrackCell,
} from "@/features/planning/income-split/bucket-history";
import type { BucketMeasure } from "@/features/planning/income-split/bucket-draft";
import styles from "@/features/planning/income-split/bucket-track.module.css";
import { useT } from "@/i18n/i18n-provider";

interface BucketEntriesSummaryProps {
  // Undefined for the spending outside the split.
  measure: BucketMeasure | undefined;
  cell: TrackCell | undefined;
  real: number;
  money: (amount: number) => string;
}

// What the month counted for the bucket, its target and, in words, how it stands against it.
export function BucketEntriesSummary({
  measure,
  cell,
  real,
  money,
}: BucketEntriesSummaryProps) {
  const t = useT();
  const target = measure === undefined ? undefined : cell?.target;
  const status =
    measure === undefined || cell === undefined
      ? undefined
      : cellStatus(measure, cell);
  const missed =
    status?.kind === "over" ||
    status?.kind === "short" ||
    status?.kind === "toGo";

  return (
    <div>
      <div className={styles.sumRow}>
        <Text size="sm">{t("track.entries.real")}</Text>
        <Text size="sm" weight="medium" numeric="tabular">
          {money(real)}
        </Text>
      </div>
      {target !== undefined && (
        <div className={styles.sumRow}>
          <Text size="sm">{t("track.entries.targetLabel")}</Text>
          <Text size="sm" weight="medium" numeric="tabular">
            {money(target)}
          </Text>
        </div>
      )}
      {status !== undefined && (
        <div className={styles.sumRow}>
          <span />
          <Text
            size="sm"
            weight="medium"
            numeric="tabular"
            {...(missed ? { tone: "danger" as const } : {})}
          >
            {t(`track.${status.kind}`, { amount: money(status.amount) })}
          </Text>
        </div>
      )}
    </div>
  );
}
