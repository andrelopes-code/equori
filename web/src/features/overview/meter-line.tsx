import { Text } from "@slotted/react/typography";

import type { MeterTone } from "@/features/overview/meter-head";
import styles from "@/features/overview/meter-row.module.css";
import { GoalMeter } from "@/features/goals";

// CP-04, after goal-card: the description of a row that measures progress. The segmented meter
// of the goals page, then what the share is made of and where it stands. progress-indicator
// draws the bar alone; the figures under it are the row's own.
export function MeterLine({
  label,
  basisPoints,
  share,
  tone,
  amounts,
  status,
  statusTone,
}: {
  label: string;
  basisPoints: number;
  share: string;
  tone: MeterTone;
  // "R$ 501,56 of R$ 900,00".
  amounts: string;
  // "R$ 398,44 left", "3 months left".
  status: string;
  statusTone: "muted" | MeterTone;
}) {
  return (
    <span className={styles.line} data-tone={tone}>
      <GoalMeter label={label} basisPoints={basisPoints} text={share} />
      <span className={styles.figures}>
        <Text size="sm" tone="muted" numeric="tabular">
          {amounts}
        </Text>
        <Text
          size="sm"
          tone={statusTone}
          numeric="tabular"
          className={styles.status}
        >
          {status}
        </Text>
      </span>
    </span>
  );
}
