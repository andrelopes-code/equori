import { Text } from "@slotted/react/typography";

import styles from "@/features/portfolio/contribution-plan/editor/edit-list.module.css";
import { shareText } from "@/features/portfolio/contribution-plan/model/share-text";
import { useAppLocale } from "@/i18n/i18n-provider";

interface TodayShareProps {
  // Basis points.
  bp: number;
}

// The share today of a row, muted.
export function TodayShare({ bp }: TodayShareProps) {
  const [tag] = useAppLocale();

  return (
    <Text size="md" tone="muted" className={styles.figure}>
      {shareText(bp / 10000, tag)}
    </Text>
  );
}
