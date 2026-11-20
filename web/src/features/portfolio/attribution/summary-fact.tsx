import { Text } from "@slotted/react/typography";

import styles from "@/features/portfolio/attribution/year-summary.module.css";

interface SummaryFactProps {
  label: string;
  value: string;
  tone: "success" | "danger" | "default";
}

// One figure under the summary: its name above, its value in the tone of its sign.
export function SummaryFact({ label, value, tone }: SummaryFactProps) {
  return (
    <div className={styles.fact}>
      <Text size="xs" tone="muted" className={styles.nowrap}>
        {label}
      </Text>
      <Text size="md" weight="semibold" tone={tone} className={styles.figure}>
        {value}
      </Text>
    </div>
  );
}
