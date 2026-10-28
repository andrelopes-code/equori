import { Text } from "@slotted/react/typography";

import styles from "@/features/overview/meter-row.module.css";

export type MeterTone = "accent" | "success" | "warning" | "danger";

// The title line of a row that measures progress: the name and its share on one baseline, the
// share in the row's tone. The figure sits in the title so the meter under it spans the row.
export function MeterHead({
  name,
  share,
  tone,
}: {
  name: string;
  share: string;
  tone: MeterTone;
}) {
  return (
    <span className={styles.head}>
      <span className={styles.name}>{name}</span>
      <Text size="sm" weight="semibold" numeric="tabular" tone={tone}>
        {share}
      </Text>
    </span>
  );
}
