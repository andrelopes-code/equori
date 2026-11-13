import { Text } from "@slotted/react/typography";

import styles from "@/features/portfolio/contribution-plan/ideal/ideal-grid.module.css";
import { statusText } from "@/features/portfolio/contribution-plan/model/group-status";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface EntryStatusProps {
  today: number;
  // The share after this contribution; undefined without an amount.
  after: number | undefined;
  ideal: number | undefined;
  member: boolean;
}

// The status column of a row, in words.
export function EntryStatus({ today, after, ideal, member }: EntryStatusProps) {
  const t = useT();
  const [tag] = useAppLocale();

  return (
    <Text size="sm" className={styles.status}>
      {statusText({ today, after, ideal, member, t, tag })}
    </Text>
  );
}
